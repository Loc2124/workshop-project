CREATE TABLE message_templates (
 key text PRIMARY KEY CHECK(key IN ('studio_approved','studio_needs_changes','studio_rejected','studio_suspended','booking_success','booking_cancelled')),
 subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 5000),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_templates FROM anon,authenticated;

CREATE FUNCTION default_message_template(template_key text) RETURNS TABLE(subject text,body text) LANGUAGE sql IMMUTABLE AS $$
 SELECT v.subject,v.body FROM (VALUES
 ('studio_approved','Studio {{studioName}} đã được duyệt','Studio {{studioName}} đã được Open Slot duyệt. Bạn có thể quản lý workshop, lịch và đặt chỗ trong trang quản lý studio.'),
 ('studio_needs_changes','Studio {{studioName}} cần bổ sung thông tin','Hồ sơ studio {{studioName}} cần bổ sung trước khi được duyệt.
Lý do: {{reason}}
Vui lòng chỉnh sửa hồ sơ và gửi lại để Open Slot kiểm tra.'),
 ('studio_rejected','Hồ sơ studio {{studioName}} bị từ chối','Open Slot chưa thể duyệt hồ sơ studio {{studioName}}.
Lý do: {{reason}}
Bạn có thể cập nhật hồ sơ và gửi lại để được xem xét.'),
 ('studio_suspended','Studio {{studioName}} đã bị tạm ngưng','Studio {{studioName}} đã bị tạm ngưng trên Open Slot.
Lý do: {{reason}}
Vui lòng liên hệ Open Slot để được hỗ trợ.'),
 ('booking_success','Đặt chỗ {{bookingCode}} thành công','Chào {{customerName}}, Open Slot đã ghi nhận đặt chỗ {{bookingCode}}.
Workshop: {{workshopName}} tại {{studioName}}
Thời gian: {{slotTime}}
Số người: {{quantity}}
Trạng thái đặt chỗ: {{bookingStatus}}
Trạng thái thanh toán: {{paymentStatus}}'),
 ('booking_cancelled','Đặt chỗ {{bookingCode}} đã bị hủy','Chào {{customerName}}, đặt chỗ {{bookingCode}} cho workshop {{workshopName}} tại {{studioName}} đã bị hủy.
Thời gian: {{slotTime}}
Lý do: {{reason}}
Trạng thái thanh toán: {{paymentStatus}}')
 ) AS v(key,subject,body) WHERE v.key=template_key;
$$;
INSERT INTO message_templates(key,subject,body)
 SELECT k.key,d.subject,d.body FROM unnest(ARRAY['studio_approved','studio_needs_changes','studio_rejected','studio_suspended','booking_success','booking_cancelled']) AS k(key)
 CROSS JOIN LATERAL default_message_template(k.key) d;

CREATE FUNCTION message_template_variables(template_key text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE
 WHEN template_key='studio_approved' THEN ARRAY['studioName']
 WHEN template_key IN ('studio_needs_changes','studio_rejected','studio_suspended') THEN ARRAY['studioName','reason']
 WHEN template_key='booking_success' THEN ARRAY['customerName','studioName','workshopName','bookingCode','slotTime','quantity','bookingStatus','paymentStatus']
 WHEN template_key='booking_cancelled' THEN ARRAY['customerName','studioName','workshopName','bookingCode','slotTime','quantity','bookingStatus','paymentStatus','reason']
 ELSE ARRAY[]::text[] END;
$$;
CREATE FUNCTION render_message_text(template_key text,source text,variables jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rest text:=coalesce(source,''); result text:=''; match text[]; token text; variable text; offset_at integer;
BEGIN
 LOOP
  match:=regexp_match(rest,'\{\{([^}]*)\}\}');
  EXIT WHEN match IS NULL;
  token:='{{'||match[1]||'}}';variable:=regexp_replace(match[1],'^\s+|\s+$','','g');offset_at:=strpos(rest,token);
  result:=result||left(rest,offset_at-1);
  IF variable=ANY(message_template_variables(template_key)) THEN result:=result||coalesce(variables->>variable,''); END IF;
  rest:=substring(rest FROM offset_at+length(token));
 END LOOP;
 RETURN result||rest;
END;
$$;
CREATE FUNCTION render_message_template(template_key text,variables jsonb) RETURNS TABLE(subject text,body text) LANGUAGE sql STABLE AS $$
 SELECT trim(regexp_replace(render_message_text(template_key,t.subject,variables),E'[\r\n]+',' ','g')),render_message_text(template_key,t.body,variables)
 FROM message_templates t WHERE t.key=template_key;
$$;
REVOKE ALL ON FUNCTION default_message_template(text),message_template_variables(text),render_message_text(text,text,jsonb),render_message_template(text,jsonb) FROM PUBLIC,anon,authenticated;

ALTER TABLE studio_notifications ADD COLUMN body text, ADD COLUMN template_key text REFERENCES message_templates(key), ADD COLUMN booking_id uuid REFERENCES bookings(id);
CREATE INDEX studio_notifications_booking_idx ON studio_notifications(booking_id) WHERE booking_id IS NOT NULL;

CREATE FUNCTION notify_studio_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_key text;
BEGIN
 IF NEW.is_draft OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 template_key:=CASE NEW.status::text WHEN 'approved' THEN 'studio_approved' WHEN 'needs_changes' THEN 'studio_needs_changes' WHEN 'rejected' THEN 'studio_rejected' WHEN 'suspended' THEN 'studio_suspended' END;
 IF template_key IS NULL THEN RETURN NEW; END IF;
 INSERT INTO studio_notifications(user_id,studio_id,title,body,reason,template_key)
 SELECT sm.user_id,NEW.id,m.subject,m.body,NEW.rejection_reason,template_key FROM studio_members sm
 CROSS JOIN render_message_template(template_key,jsonb_build_object('studioName',NEW.name,'reason',coalesce(NEW.rejection_reason,''))) m
 WHERE sm.studio_id=NEW.id AND sm.role='owner';
 RETURN NEW;
END;
$$;
CREATE TRIGGER studio_template_notification AFTER UPDATE OF status ON studios FOR EACH ROW EXECUTE FUNCTION notify_studio_template();

CREATE FUNCTION notify_booking_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_key text; event_reason text; variables jsonb; studio uuid; workshop uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.reservation_status IN ('pending','confirmed') THEN template_key:='booking_success'; END IF;
 ELSIF NEW.reservation_status='cancelled' AND OLD.reservation_status IS DISTINCT FROM NEW.reservation_status THEN template_key:='booking_cancelled';
 ELSIF NEW.reservation_status='confirmed' AND (OLD.reservation_status IS DISTINCT FROM NEW.reservation_status OR (NEW.status='paid' AND OLD.status IS DISTINCT FROM NEW.status)) THEN template_key:='booking_success';
 END IF;
 IF template_key IS NULL THEN RETURN NEW; END IF;
 event_reason:=coalesce(nullif(current_setting('app.booking_reason',true),''),CASE WHEN NEW.status='expired' THEN 'Đã hết thời gian giữ chỗ.' ELSE 'Buổi workshop hoặc đặt chỗ đã bị hủy.' END);
 SELECT st.id,w.id,jsonb_build_object('customerName',u.full_name,'studioName',st.name,'workshopName',w.title,'bookingCode',NEW.order_code::text,'slotTime',to_char(s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI'),'quantity',NEW.quantity::text,'reason',event_reason,
 'bookingStatus',CASE NEW.reservation_status WHEN 'pending' THEN 'Chờ xác nhận' WHEN 'confirmed' THEN 'Đã xác nhận' WHEN 'cancelled' THEN 'Đã hủy' ELSE 'Hoàn tất' END,
 'paymentStatus',CASE NEW.status::text WHEN 'pending' THEN 'Chưa thanh toán' WHEN 'paid' THEN 'Đã thanh toán' WHEN 'refund_needed' THEN 'Cần hoàn tiền' WHEN 'expired' THEN 'Hết hạn giữ chỗ' ELSE 'Đã hủy' END)
 INTO studio,workshop,variables FROM users u JOIN sessions s ON s.id=NEW.session_id JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id WHERE u.id=NEW.user_id;
 INSERT INTO studio_notifications(user_id,studio_id,workshop_id,booking_id,title,body,reason,template_key)
 SELECT NEW.user_id,studio,workshop,NEW.id,m.subject,m.body,CASE WHEN template_key='booking_cancelled' THEN event_reason END,template_key FROM render_message_template(template_key,variables) m;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_template_notification AFTER INSERT OR UPDATE OF reservation_status,status ON bookings FOR EACH ROW EXECUTE FUNCTION notify_booking_template();

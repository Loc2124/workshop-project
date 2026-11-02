ALTER TABLE users ADD COLUMN is_blocked boolean NOT NULL DEFAULT false,
 ADD COLUMN blocked_reason text,
 ADD COLUMN blocked_by uuid REFERENCES users(id),
 ADD COLUMN blocked_at timestamptz,
 ADD COLUMN avatar_url text;
CREATE INDEX users_admin_list_idx ON users(is_blocked,role,created_at DESC);
UPDATE users u SET role='studio_owner' WHERE role='customer'
 AND EXISTS(SELECT 1 FROM studio_members sm WHERE sm.user_id=u.id AND sm.role='owner');

-- New owners are promoted on first ownership; administrators keep their role.
CREATE FUNCTION promote_studio_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='owner' THEN UPDATE users SET role='studio_owner' WHERE id=NEW.user_id AND role='customer'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER studio_owner_account_role AFTER INSERT OR UPDATE OF role ON studio_members FOR EACH ROW EXECUTE FUNCTION promote_studio_owner();

-- Serialize session issuance with account moderation, including concurrent login.
CREATE FUNCTION guard_account_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blocked boolean;
BEGIN
 SELECT is_blocked INTO blocked FROM users WHERE id=NEW.user_id FOR SHARE;
 IF blocked THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER account_session_guard BEFORE INSERT OR UPDATE OF refresh_token_hash ON auth_sessions FOR EACH ROW EXECUTE FUNCTION guard_account_session();

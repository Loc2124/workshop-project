import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { query, closePool, withTransaction } from '../apps/api/src/db/pool.js';
import { encryptFinancialAccount } from '../apps/api/src/modules/payments/financial-account-crypto.js';

async function main() {
  console.log('--- BẮT ĐẦU TẠO DỮ LIỆU DEMO CHO BUỔI THI ---');

  await withTransaction(async (client) => {
    // 1. Password hash chung cho các tài khoản test: 'openslot123'
    const passwordHash = await argon2.hash('openslot123');

    // 2. Tạo các User
    const users = [
      {
        id: randomUUID(),
        email: 'chustudio.hanoi@openslot.io.vn',
        fullName: 'Trần Minh Tâm (Chủ xưởng Hà Nội)',
        phone: '0912345678',
        role: 'customer',
      },
      {
        id: randomUUID(),
        email: 'chustudio.saigon@openslot.io.vn',
        fullName: 'Lê Hoàng Yến (Chủ xưởng Sài Gòn)',
        phone: '0987654321',
        role: 'customer',
      },
      {
        id: randomUUID(),
        email: 'chustudio.danang@openslot.io.vn',
        fullName: 'Nguyễn Vũ Phong (Chủ xưởng Đà Nẵng)',
        phone: '0905123456',
        role: 'customer',
      },
      {
        id: randomUUID(),
        email: 'khachhang1@openslot.io.vn',
        fullName: 'Phạm Hải Đăng (Khách đặt vé)',
        phone: '0934567890',
        role: 'customer',
      },
      {
        id: randomUUID(),
        email: 'khachhang2@openslot.io.vn',
        fullName: 'Vũ Phương Linh (Khách đặt vé)',
        phone: '0978901234',
        role: 'customer',
      },
    ];

    const userMap = new Map<string, string>();
    for (const u of users) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO users (id, email, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
         RETURNING id`,
        [u.id, u.email, passwordHash, u.fullName, u.phone, u.role],
      );
      userMap.set(u.email, res.rows[0].id);
      console.log(`✓ Đã tạo/cập nhật tài khoản: ${u.email} (Mật khẩu: openslot123)`);
    }

    // Lấy ID admin hiện tại
    const adminRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin@openslot.io.vn' LIMIT 1`,
    );
    const adminId = adminRes.rows[0]?.id;

    const hanoiOwnerId = userMap.get('chustudio.hanoi@openslot.io.vn')!;
    const saigonOwnerId = userMap.get('chustudio.saigon@openslot.io.vn')!;
    const danangOwnerId = userMap.get('chustudio.danang@openslot.io.vn')!;

    // 3. Tạo các Studio
    const studios = [
      {
        id: randomUUID(),
        name: 'Gốm Mộc Hà Nội',
        slug: 'gom-moc-ha-noi',
        category_id: 'ceramics',
        province_id: 'ha-noi',
        district: 'Tây Hồ',
        address: 'Số 18 Ngõ 45 Đường Quảng An, Phường Quảng An, Tây Hồ, Hà Nội',
        description: 'Không gian trải nghiệm làm gốm thủ công phong cách mộc mạc bên hồ Tây. Nơi bạn tự tay vuốt nặn, tạo hình và trang trí những chiếc cốc, đĩa mang dấu ấn cá nhân cùng sự hướng dẫn tỉ mỉ của nghệ nhân.',
        contact_phone: '0912345678',
        contact_email: 'gommoc.hanoi@gmail.com',
        facebook_url: 'https://facebook.com/gommoc.hanoi',
        instagram_url: 'https://instagram.com/gommoc.hanoi',
        google_maps_url: 'https://maps.app.goo.gl/studio-gom-moc-hanoi',
        status: 'approved',
        verified: true, // Bậc 2: Đã xác minh
        ownerId: hanoiOwnerId,
        bank: {
          name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
          bin: '970418',
          account: '12410001234567',
          holder: 'TRAN MINH TAM',
        },
      },
      {
        id: randomUUID(),
        name: 'Tiệm Nến Thơm Mùa Thu',
        slug: 'tiem-nen-thom-mua-thu',
        category_id: 'candles',
        province_id: 'ha-noi',
        district: 'Hoàn Kiếm',
        address: 'Tầng 2, 36 Phố Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm, Hà Nội',
        description: 'Workshop làm nến thơm tự nhiên từ sáp đậu nành, tinh dầu thực vật cao cấp và hoa khô trang trí nghệ thuật. Tận hưởng không gian ấm cúng, thư giãn và mang về hũ nến mang hương sắc của riêng bạn.',
        contact_phone: '0912345679',
        contact_email: 'nenthom.muathu@gmail.com',
        facebook_url: 'https://facebook.com/nenthom.muathu',
        instagram_url: 'https://instagram.com/nenthom.muathu',
        google_maps_url: 'https://maps.app.goo.gl/tiem-nen-thom-mua-thu',
        status: 'approved',
        verified: false, // Bậc 1: Đã duyệt hồ sơ
        ownerId: hanoiOwnerId,
        bank: {
          name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
          bin: '970436',
          account: '0011004567890',
          holder: 'TRAN MINH TAM',
        },
      },
      {
        id: randomUUID(),
        name: 'Art & Soul Canvas Sài Gòn',
        slug: 'art-soul-canvas-sai-gon',
        category_id: 'painting',
        province_id: 'ho-chi-minh',
        district: 'Quận 1',
        address: '128/6 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
        description: 'Lớp vẽ tranh thư giãn phong cách Canvas Acrylic dành cho người chưa từng cầm cọ. Cùng nhâm nhi trà hoa, nghe nhạc acoustic và sáng tác tác phẩm hội họa mang về treo phòng khách.',
        contact_phone: '0987654321',
        contact_email: 'artsoul.saigon@gmail.com',
        facebook_url: 'https://facebook.com/artsoul.saigon',
        instagram_url: 'https://instagram.com/artsoul.saigon',
        google_maps_url: 'https://maps.app.goo.gl/artsoul-saigon',
        status: 'approved',
        verified: true, // Bậc 2: Đã xác minh
        ownerId: saigonOwnerId,
        bank: {
          name: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
          bin: '970407',
          account: '19036789012345',
          holder: 'LE HOANG YEN',
        },
      },
      {
        id: randomUUID(),
        name: 'Scent Lab Đà Nẵng',
        slug: 'scent-lab-da-nang',
        category_id: 'perfume',
        province_id: 'da-nang',
        district: 'Sơn Trà',
        address: '45 Đường Võ Văn Kiệt, Phường An Hải Đông, Sơn Trà, Đà Nẵng',
        description: 'Trải nghiệm sáng tạo hương thơm cá nhân với hơn 50 nốt hương tinh dầu hữu cơ. Tự pha chế chai nước hoa cao cấp 30ml mang dấu ấn riêng biệt.',
        contact_phone: '0905123456',
        contact_email: 'scentlab.danang@gmail.com',
        facebook_url: 'https://facebook.com/scentlab.danang',
        instagram_url: 'https://instagram.com/scentlab.danang',
        google_maps_url: 'https://maps.app.goo.gl/scentlab-danang',
        status: 'pending', // Chờ duyệt (để demo Admin duyệt)
        verified: false,
        ownerId: danangOwnerId,
        bank: null,
      },
    ];

    const studioMap = new Map<string, string>();

    for (const s of studios) {
      // 3.1 Insert studio trước
      const studioRes = await client.query<{ id: string }>(
        `INSERT INTO studios (
          id, name, slug, category_id, province_id, district, address, description,
          contact_phone, contact_email, photo_ids, facebook_url, instagram_url, google_maps_url,
          status, verified_at, verified_by, is_draft, is_hidden, deposit_mode
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, '{}', $11, $12, $13,
          $14::approval_status, CASE WHEN $15 THEN clock_timestamp() ELSE NULL END, CASE WHEN $15 THEN $16::uuid ELSE NULL END, false, false, 'none'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, description = EXCLUDED.description, address = EXCLUDED.address,
          status = EXCLUDED.status, verified_at = EXCLUDED.verified_at, verified_by = EXCLUDED.verified_by
        RETURNING id`,
        [
          s.id, s.name, s.slug, s.category_id, s.province_id, s.district, s.address, s.description,
          s.contact_phone, s.contact_email, s.facebook_url, s.instagram_url, s.google_maps_url,
          s.status, s.verified, adminId,
        ],
      );
      const actualStudioId = studioRes.rows[0].id;
      studioMap.set(s.slug, actualStudioId);

      // 3.2 Insert ảnh minh chứng cho studio
      const photoIds = [randomUUID(), randomUUID(), randomUUID()];
      for (const pid of photoIds) {
        await client.query(
          `INSERT INTO images (id, studio_id, uploaded_by, key, state, byte_size)
           VALUES ($1, $2, $3, $4, 'ready', 102400)
           ON CONFLICT (id) DO NOTHING`,
          [pid, actualStudioId, s.ownerId, `studios/${actualStudioId}/profile/${pid}.webp`],
        );
      }

      // 3.3 Cập nhật photo_ids cho studio
      await client.query(
        `UPDATE studios SET photo_ids = $1 WHERE id = $2`,
        [photoIds, actualStudioId],
      );

      // 3.4 Thêm thành viên owner
      await client.query(
        `INSERT INTO studio_members (studio_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (studio_id, user_id) DO NOTHING`,
        [actualStudioId, s.ownerId],
      );

      // 3.4 Thêm tài khoản ngân hàng payout đã xác minh
      if (s.bank) {
        const enc = encryptFinancialAccount(s.bank.account);
        await client.query(
          `INSERT INTO studio_payout_accounts (
            studio_id, bank_name, bank_bin, account_holder, account_last4,
            encrypted_number, encryption_iv, encryption_tag, status, is_current, changed_by,
            verified_by, verified_at, verification_reference
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', true, $9, $10, clock_timestamp(), 'REF-SYS-VERIFIED')
          ON CONFLICT DO NOTHING`,
          [
            actualStudioId,
            s.bank.name,
            s.bank.bin,
            s.bank.holder,
            s.bank.account.slice(-4),
            enc.encrypted,
            enc.iv,
            enc.tag,
            s.ownerId,
            adminId,
          ],
        );
      }

      console.log(`✓ Đã tạo Studio: ${s.name} (${s.status}${s.verified ? ' - Đã xác minh' : ''})`);
    }

    // 4. Tạo các Workshop & Sessions
    const workshops = [
      {
        studioSlug: 'gom-moc-ha-noi',
        title: 'Nặn gốm thủ công trên bàn xoay & Vẽ men màu nghệ thuật',
        slug: 'nan-gom-thu-cong-tren-ban-xoay-ve-men-mau',
        category_id: 'ceramics',
        level: 'beginner',
        audience: ['cặp đôi', 'nhóm bạn', 'một mình'],
        takeaway: '1 sản phẩm cốc hoặc đĩa gốm nung men bóng cao cấp nhận sau 7-10 ngày',
        duration_minutes: 120,
        base_price: 350000,
        requirements: 'Không cần kinh nghiệm, xưởng trang bị sẵn tạp dề và nguyên liệu trọn gói',
        cancellation_policy: 'Hoàn 100% tiền khi hủy trước thời gian bắt đầu tối thiểu 24 giờ',
        payment_policy: 'Thanh toán trực tuyến VietQR qua cổng PayOS hoặc quét mã tại xưởng',
        district: 'Tây Hồ',
        address: 'Số 18 Ngõ 45 Đường Quảng An, Phường Quảng An, Tây Hồ, Hà Nội',
        description: 'Trải nghiệm tự tay làm gốm từ khâu nhào đất, vuốt gốm trên bàn xoay điện chuyên nghiệp đến khắc họa tiết và tô men màu. Phù hợp cho cả các bạn mới bắt đầu muốn giải tỏa căng thẳng cuối tuần.',
        sessions: [
          { dayOffset: 1, startHour: 9, startMin: 0, duration: 120, capacity: 10, price: 350000 },
          { dayOffset: 1, startHour: 14, startMin: 30, duration: 120, capacity: 10, price: 350000 },
          { dayOffset: 2, startHour: 10, startMin: 0, duration: 120, capacity: 10, price: 350000 },
          { dayOffset: 3, startHour: 15, startMin: 0, duration: 120, capacity: 12, price: 350000 },
          { dayOffset: 5, startHour: 9, startMin: 30, duration: 120, capacity: 12, price: 350000 },
        ],
      },
      {
        studioSlug: 'gom-moc-ha-noi',
        title: 'Tạo hình đĩa trang trí và lót ly hoạ tiết hoa cỏ',
        slug: 'tao-hinh-dia-trang-tri-lot-ly-hoa-co',
        category_id: 'ceramics',
        level: 'beginner',
        audience: ['nhóm bạn', 'cặp đôi'],
        takeaway: 'Bộ 2 đĩa lót ly nung gốm men mờ phong cách tối giản',
        duration_minutes: 90,
        base_price: 280000,
        requirements: 'Phù hợp mọi độ tuổi, không cần chuẩn bị trước',
        cancellation_policy: 'Hủy trước 24 giờ hoàn 100% chi phí',
        payment_policy: 'Thanh toán quét mã VietQR PayOS',
        district: 'Tây Hồ',
        address: 'Số 18 Ngõ 45 Đường Quảng An, Phường Quảng An, Tây Hồ, Hà Nội',
        description: 'Tự tay cán đất, in dấu hoa lá thiên nhiên lên bề mặt gốm để tạo nên những chiếc đĩa và đế lót ly mộc mạc, độc bản trang trí góc làm việc của bạn.',
        sessions: [
          { dayOffset: 1, startHour: 16, startMin: 30, duration: 90, capacity: 8, price: 280000 },
          { dayOffset: 2, startHour: 14, startMin: 0, duration: 90, capacity: 8, price: 280000 },
          { dayOffset: 4, startHour: 10, startMin: 0, duration: 90, capacity: 8, price: 280000 },
        ],
      },
      {
        studioSlug: 'tiem-nen-thom-mua-thu',
        title: 'Tự tay làm nến thơm sáp đậu nành & Hoa khô nghệ thuật',
        slug: 'tu-tay-lam-nen-thom-sap-dau-nanh-hoa-kho',
        category_id: 'candles',
        level: 'beginner',
        audience: ['cặp đôi', 'nhóm bạn', 'một mình'],
        takeaway: '1 hũ nến thơm 200g đóng hộp quà cao cấp mang về sử dụng ngay',
        duration_minutes: 90,
        base_price: 290000,
        requirements: 'Không cần kinh nghiệm, đầy đủ nguyên liệu sáp và tinh dầu cao cấp',
        cancellation_policy: 'Hủy trước 24 giờ hoàn 100% tiền cọc',
        payment_policy: 'Hỗ trợ thanh toán VietQR chuyển khoản nhanh 24/7',
        district: 'Hoàn Kiếm',
        address: 'Tầng 2, 36 Phố Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm, Hà Nội',
        description: 'Khám phá thế giới mùi hương tự nhiên, phối trộn tinh dầu hoa cỏ yêu thích, đổ sáp đậu nành ấm và trang trí hoa khô botanical theo phong cách riêng của bạn.',
        sessions: [
          { dayOffset: 1, startHour: 10, startMin: 0, duration: 90, capacity: 8, price: 290000 },
          { dayOffset: 1, startHour: 15, startMin: 0, duration: 90, capacity: 8, price: 290000 },
          { dayOffset: 2, startHour: 15, startMin: 30, duration: 90, capacity: 8, price: 290000 },
          { dayOffset: 3, startHour: 10, startMin: 0, duration: 90, capacity: 10, price: 290000 },
        ],
      },
      {
        studioSlug: 'tiem-nen-thom-mua-thu',
        title: 'Sáp thơm treo tủ quần áo & Tinh dầu khuếch tán phòng',
        slug: 'sap-thom-treo-tu-quan-ao-tinh-dau-khuech-tan',
        category_id: 'candles',
        level: 'all',
        audience: ['nhóm bạn', 'một mình'],
        takeaway: '2 thanh sáp thơm hoa khô + 1 lọ tinh dầu khuếch tán 50ml kèm que mây',
        duration_minutes: 75,
        base_price: 220000,
        requirements: 'Thích hợp cho cả người mới bắt đầu',
        cancellation_policy: 'Hủy trước 24 giờ miễn phí',
        payment_policy: 'Quét mã VietQR PayOS xác nhận tức thì',
        district: 'Hoàn Kiếm',
        address: 'Tầng 2, 36 Phố Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm, Hà Nội',
        description: 'Tạo nên những thanh sáp thơm trang trí tủ quần áo, bàn trang điểm và lọ tinh dầu tỏa hương dịu mát cho căn phòng của bạn.',
        sessions: [
          { dayOffset: 1, startHour: 13, startMin: 30, duration: 75, capacity: 10, price: 220000 },
          { dayOffset: 2, startHour: 10, startMin: 0, duration: 75, capacity: 10, price: 220000 },
          { dayOffset: 4, startHour: 14, startMin: 0, duration: 75, capacity: 10, price: 220000 },
        ],
      },
      {
        studioSlug: 'art-soul-canvas-sai-gon',
        title: 'Vẽ tranh Acrylic Canvas hoàng hôn trên biển',
        slug: 've-tranh-acrylic-canvas-hoang-hon-tren-bien',
        category_id: 'painting',
        level: 'beginner',
        audience: ['cặp đôi', 'nhóm bạn', 'một mình'],
        takeaway: '1 bức tranh Canvas kích thước 30x40cm có khung kèm túi quà xách về',
        duration_minutes: 150,
        base_price: 320000,
        requirements: 'Không yêu cầu năng khiếu, giảng viên hướng dẫn từng nét cọ cơ bản',
        cancellation_policy: 'Hủy trước 24 giờ hoàn 100% tiền cọc',
        payment_policy: 'Quét mã VietQR chuyển khoản nhanh hoặc tiền mặt',
        district: 'Quận 1',
        address: '128/6 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
        description: 'Hòa mình vào không gian nghệ thuật êm dịu, học cách pha màu Acrylic, tạo hiệu ứng chuyển sắc hoàng hôn và ráng chiều trên sóng biển.',
        sessions: [
          { dayOffset: 1, startHour: 9, startMin: 30, duration: 150, capacity: 12, price: 320000 },
          { dayOffset: 1, startHour: 14, startMin: 0, duration: 150, capacity: 12, price: 320000 },
          { dayOffset: 2, startHour: 14, startMin: 0, duration: 150, capacity: 12, price: 320000 },
          { dayOffset: 3, startHour: 18, startMin: 0, duration: 150, capacity: 12, price: 320000 },
        ],
      },
      {
        studioSlug: 'art-soul-canvas-sai-gon',
        title: 'Vẽ túi Tote vải Canvas phong cách Botanical hoa lá',
        slug: 've-tui-tote-vai-canvas-phong-cach-botanical',
        category_id: 'painting',
        level: 'beginner',
        audience: ['nhóm bạn', 'một mình'],
        takeaway: '1 túi Tote vải Canvas bền chắc do chính tay bạn trang trí',
        duration_minutes: 120,
        base_price: 250000,
        requirements: 'Bao gồm trọn gói màu chuyên dụng cho vải không phai khi giặt',
        cancellation_policy: 'Hủy trước 24 giờ hoàn 100% cọc',
        payment_policy: 'Thanh toán PayOS VietQR tự động',
        district: 'Quận 1',
        address: '128/6 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
        description: 'Tự vẽ họa tiết hoa lá phong cách vintage lên chiếc túi vải đi học, đi làm hoặc đi dạo phố cực kỳ thời trang và mang đậm cá tính riêng.',
        sessions: [
          { dayOffset: 1, startHour: 16, startMin: 30, duration: 120, capacity: 10, price: 250000 },
          { dayOffset: 2, startHour: 9, startMin: 30, duration: 120, capacity: 10, price: 250000 },
          { dayOffset: 4, startHour: 15, startMin: 0, duration: 120, capacity: 10, price: 250000 },
        ],
      },
    ];

    for (const w of workshops) {
      const studioId = studioMap.get(w.studioSlug)!;
      const workshopId = randomUUID();

      const wsRes = await client.query<{ id: string }>(
        `INSERT INTO workshops (
          id, studio_id, title, slug, category_id, level, audience, takeaway,
          duration_minutes, base_price, requirements, cancellation_policy, payment_policy,
          district, address, description, status, publication_status, visibility_status,
          is_simulated, is_discontinued
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, 'approved', 'published', 'active',
          false, false
        )
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title, description = EXCLUDED.description, base_price = EXCLUDED.base_price,
          status = 'approved', publication_status = 'published', visibility_status = 'active'
        RETURNING id`,
        [
          workshopId, studioId, w.title, w.slug, w.category_id, w.level, w.audience, w.takeaway,
          w.duration_minutes, w.base_price, w.requirements, w.cancellation_policy, w.payment_policy,
          w.district, w.address, w.description,
        ],
      );

      const actualWsId = wsRes.rows[0].id;

      // Xóa các session cũ của workshop này nếu có để tạo lại lịch mới chuẩn ngày thi
      await client.query(`DELETE FROM sessions WHERE workshop_id = $1`, [actualWsId]);

      // Tạo các Session
      const now = new Date();
      for (const s of w.sessions) {
        const start = new Date(now);
        start.setDate(now.getDate() + s.dayOffset);
        start.setHours(s.startHour, s.startMin, 0, 0);

        const end = new Date(start.getTime() + s.duration * 60_000);

        await client.query(
          `INSERT INTO sessions (
            workshop_id, starts_at, ends_at, price, capacity, seats_held, seats_sold, status
          ) VALUES ($1, $2, $3, $4, $5, 0, 0, 'scheduled')`,
          [actualWsId, start.toISOString(), end.toISOString(), s.price, s.capacity],
        );
      }

      console.log(`✓ Đã tạo Workshop: ${w.title} (${w.sessions.length} suất học)`);
    }
  });

  console.log('\n--- TẠO DỮ LIỆU DEMO THÀNH CÔNG 100% ---');
}

main()
  .catch(console.error)
  .finally(() => closePool());

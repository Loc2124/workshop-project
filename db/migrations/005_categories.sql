-- Category metadata is seeded from data/categories.json. Future changes use a new migration.
CREATE TABLE categories (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  color text,
  placeholder_image text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending')),
  sort_order integer NOT NULL DEFAULT 999,
  keywords text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  image_position text
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

INSERT INTO categories (id, slug, name, icon, color, placeholder_image, status, sort_order, keywords, description, image_position)
SELECT id, slug, name, icon, color, "placeholderImage", status, "sortOrder", keywords, description, "imagePosition"
FROM json_to_recordset($categories$[
  { "id": "ceramics", "slug": "gom", "name": "Gốm", "icon": "Amphora", "color": "#a86e4b", "placeholderImage": "/images/workshops/craftPhoto.jpg", "status": "active", "sortOrder": 1, "keywords": ["gốm", "đất sét", "nặn", "nung", "ceramics", "pottery"], "description": "Tạo hình, trang trí và nung đồ gốm thủ công." },
  { "id": "candles", "slug": "nen", "name": "Nến", "icon": "Flame", "color": "#a77b30", "placeholderImage": "/images/workshops/candlePhoto.jpg", "status": "active", "sortOrder": 2, "keywords": ["nến", "sáp", "thơm", "candle"], "description": "Đổ nến và phối hương từ các loại sáp." },
  { "id": "painting", "slug": "tranh", "name": "Tranh", "icon": "Paintbrush", "color": "#697b5b", "placeholderImage": "/images/workshops/artPhoto.jpg", "status": "active", "sortOrder": 3, "keywords": ["tranh", "vẽ", "màu", "acrylic", "painting"], "description": "Thử vẽ và phối màu trên giấy hoặc canvas." },
  { "id": "flowers", "slug": "hoa", "name": "Hoa", "icon": "Flower2", "color": "#a46e80", "placeholderImage": "/images/workshops/flowerPhoto.jpg", "status": "active", "sortOrder": 4, "keywords": ["hoa", "cắm", "bó", "floral"], "description": "Cắm và bó hoa, sắp đặt những chất liệu tự nhiên.", "imagePosition": "65% 30%" },
  { "id": "perfume", "slug": "nuoc-hoa", "name": "Nước hoa", "icon": "SprayCan", "color": "#887290", "placeholderImage": "/images/workshops/perfume-neutral.svg", "status": "active", "sortOrder": 5, "keywords": ["nước hoa", "hương", "pha chế", "perfume", "fragrance"], "description": "Khám phá các tầng hương và pha chế mùi hương cá nhân.", "imagePosition": "80% 25%" },
  { "id": "accessories", "slug": "phu-kien", "name": "Phụ kiện", "icon": "Gem", "color": "#8b7355", "placeholderImage": "/images/workshops/jewelryPhoto.jpg", "status": "active", "sortOrder": 6, "keywords": ["phụ kiện", "trang sức", "vòng tay", "jewelry"], "description": "Tự làm trang sức và phụ kiện thủ công." },
  { "id": "stamps", "slug": "khac-dau", "name": "Khắc dấu", "icon": "Stamp", "color": "#9a5a50", "placeholderImage": "/images/workshops/stampPhoto.jpg", "status": "active", "sortOrder": 7, "keywords": ["khắc dấu", "con dấu", "in", "stamp"], "description": "Thiết kế, khắc và in dấu bằng tay." },
  { "id": "soap", "slug": "xa-phong", "name": "Xà phòng", "icon": "Droplets", "color": "#658781", "placeholderImage": "/images/workshops/soapPhoto.jpg", "status": "active", "sortOrder": 8, "keywords": ["xà phòng", "soap", "tắm"], "description": "Làm xà phòng thủ công với màu và mùi hương riêng." },
  { "id": "terrazzo", "slug": "terrazzo", "name": "Terrazzo", "icon": "Shapes", "color": "#8b8173", "placeholderImage": "/images/workshops/terrazzoPhoto.jpg", "status": "active", "sortOrder": 9, "keywords": ["terrazzo", "đá mài", "đổ khuôn"], "description": "Phối mảnh màu và đổ khuôn đồ trang trí terrazzo." }
]$categories$::json) AS c(
  id text, slug text, name text, icon text, color text, "placeholderImage" text,
  status text, "sortOrder" integer, keywords text[], description text, "imagePosition" text
);
INSERT INTO categories (id, slug, name, icon, color, placeholder_image)
VALUES ('other', 'khac', U&'Kh\00E1c', 'Shapes', '#78716c', '/images/workshops/category-default.svg');

-- Preserve every unrecognized legacy subject as a pending category rather than discard it.
INSERT INTO categories (id, slug, name, keywords)
SELECT 'legacy-' || md5(lower(trim(w.category))), 'legacy-' || md5(lower(trim(w.category))), min(trim(w.category)), ARRAY[min(trim(w.category))]
FROM workshops w
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = lower(trim(w.category)) OR lower(c.name) = lower(trim(w.category)) OR c.slug = lower(trim(w.category)))
GROUP BY lower(trim(w.category));

ALTER TABLE workshops ADD COLUMN category_id text REFERENCES categories(id);
UPDATE workshops w SET category_id = c.id FROM categories c
WHERE c.id = lower(trim(w.category)) OR lower(c.name) = lower(trim(w.category)) OR c.slug = lower(trim(w.category));
UPDATE workshops SET category_id = 'legacy-' || md5(lower(trim(category))) WHERE category_id IS NULL;
ALTER TABLE workshops ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE workshops ALTER COLUMN category_id SET DEFAULT 'other';
ALTER TABLE workshops DROP COLUMN category;
CREATE INDEX idx_workshops_category ON workshops(category_id, status);

ALTER TABLE studios ADD COLUMN category_id text NOT NULL DEFAULT 'other' REFERENCES categories(id);
UPDATE studios st SET category_id = ranked.category_id FROM (
  SELECT DISTINCT ON (studio_id) studio_id, category_id
  FROM workshops GROUP BY studio_id, category_id ORDER BY studio_id, count(*) DESC, category_id
) ranked WHERE ranked.studio_id = st.id;
CREATE INDEX idx_studios_category ON studios(category_id);

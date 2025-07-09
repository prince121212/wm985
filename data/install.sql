-- ============================================
-- 文明知识库完整数据库初始化脚本
-- 版本：v2.0
-- 更新时间：2025-06-26
-- 说明：包含完整的数据库结构、索引优化和数据修复
-- 注意：不包含初始数据，所有数据通过管理接口录入确保安全性
-- ============================================

-- 开始事务
BEGIN;

-- 显示初始化开始信息
DO $$
BEGIN
    RAISE NOTICE '=== 文明知识库数据库初始化开始 ===';
    RAISE NOTICE '开始时间: %', NOW();
    RAISE NOTICE '脚本版本: v2.0';
END $$;

-- ============================================
-- 第一部分：基础表结构
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    nickname VARCHAR(255),
    avatar_url VARCHAR(255),
    locale VARCHAR(50),
    signin_type VARCHAR(50),
    signin_ip VARCHAR(255),
    signin_provider VARCHAR(50),
    signin_openid VARCHAR(255),
    invite_code VARCHAR(255) NOT NULL default '',
    updated_at timestamptz DEFAULT NOW(),
    invited_by VARCHAR(255) NOT NULL default '',
    is_affiliate BOOLEAN NOT NULL default false,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at timestamptz,
    password_hash VARCHAR(255), -- 用于邮箱注册用户的密码
    total_access_count INTEGER NOT NULL DEFAULT 0, -- 用户总访问数
    total_approved_resources INTEGER NOT NULL DEFAULT 0, -- 用户总通过审核的资源数
    UNIQUE (email, signin_provider)
);

-- 为已存在的用户表添加新字段（兼容已有数据库）
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_access_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_approved_resources INTEGER NOT NULL DEFAULT 0;

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz,
    user_uuid VARCHAR(255) NOT NULL DEFAULT '',
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    amount INT NOT NULL,
    interval VARCHAR(50),
    expired_at timestamptz,
    status VARCHAR(50) NOT NULL,
    stripe_session_id VARCHAR(255),
    credits INT NOT NULL,
    currency VARCHAR(50),
    sub_id VARCHAR(255),
    sub_interval_count int,
    sub_cycle_anchor int,
    sub_period_end int,
    sub_period_start int,
    sub_times int,
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    valid_months int,
    order_detail TEXT,
    paid_at timestamptz,
    paid_email VARCHAR(255),
    paid_detail TEXT
);

-- API密钥表
CREATE TABLE IF NOT EXISTS apikeys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(100),
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active'
);

-- 积分表
CREATE TABLE IF NOT EXISTS credits (
    id SERIAL PRIMARY KEY,
    trans_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    user_uuid VARCHAR(255) NOT NULL,
    trans_type VARCHAR(50) NOT NULL,
    credits INT NOT NULL,
    order_no VARCHAR(255),
    expired_at timestamptz
);

-- 文章表
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    content TEXT,
    created_at timestamptz,
    updated_at timestamptz,
    status VARCHAR(50),
    cover_url VARCHAR(255),
    author_name VARCHAR(255),
    author_avatar_url VARCHAR(255),
    locale VARCHAR(50)
);

-- 联盟表
create table IF NOT EXISTS affiliates (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz,
    status VARCHAR(50) NOT NULL default '',
    invited_by VARCHAR(255) NOT NULL,
    paid_order_no VARCHAR(255) NOT NULL default '',
    paid_amount INT NOT NULL default 0,
    reward_percent INT NOT NULL default 0,
    reward_amount INT NOT NULL default 0
);

-- 反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
    id SERIAL PRIMARY KEY,
    created_at timestamptz,
    status VARCHAR(50),
    user_uuid VARCHAR(255),
    content TEXT,
    rating INT
);

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'register', 'reset_password', 'change_email'
    created_at timestamptz DEFAULT NOW(),
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    is_used BOOLEAN DEFAULT FALSE,
    user_uuid VARCHAR(255)
);

-- ============================================
-- 第二部分：资源管理表结构
-- ============================================

-- 资源分类表
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    icon VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    resource_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 资源主表
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    content TEXT,
    file_url VARCHAR(1000),
    category_id INTEGER REFERENCES categories(id),
    author_id VARCHAR(255) REFERENCES users(uuid),
    status VARCHAR(50) DEFAULT 'pending',
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_free BOOLEAN DEFAULT TRUE,
    credits INTEGER DEFAULT 0,
    rejection_reason TEXT,
    ai_risk_score INTEGER DEFAULT NULL,
    ai_review_result TEXT DEFAULT NULL,
    ai_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    auto_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 资源标签关联表
CREATE TABLE IF NOT EXISTS resource_tags (
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, tag_id)
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_uuid, resource_id)
);

-- 资源评分表
CREATE TABLE IF NOT EXISTS resource_ratings (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_uuid, resource_id)
);

-- 资源评论表
CREATE TABLE IF NOT EXISTS resource_comments (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES resource_comments(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 第三部分：索引优化
-- ============================================

-- 基础表索引
DO $$
BEGIN
    -- users 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON users(email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_uuid') THEN
        CREATE INDEX idx_users_uuid ON users(uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_created_at') THEN
        CREATE INDEX idx_users_created_at ON users(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_signin_provider') THEN
        CREATE INDEX idx_users_signin_provider ON users(signin_provider);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email_verified') THEN
        CREATE INDEX idx_users_email_verified ON users(email_verified);
    END IF;

    -- orders 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_user_uuid') THEN
        CREATE INDEX idx_orders_user_uuid ON orders(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_user_email') THEN
        CREATE INDEX idx_orders_user_email ON orders(user_email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_status') THEN
        CREATE INDEX idx_orders_status ON orders(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_created_at') THEN
        CREATE INDEX idx_orders_created_at ON orders(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_paid_at') THEN
        CREATE INDEX idx_orders_paid_at ON orders(paid_at);
    END IF;

    -- apikeys 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'apikeys' AND indexname = 'idx_apikeys_user_uuid') THEN
        CREATE INDEX idx_apikeys_user_uuid ON apikeys(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'apikeys' AND indexname = 'idx_apikeys_status') THEN
        CREATE INDEX idx_apikeys_status ON apikeys(status);
    END IF;

    -- credits 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credits' AND indexname = 'idx_credits_user_uuid') THEN
        CREATE INDEX idx_credits_user_uuid ON credits(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credits' AND indexname = 'idx_credits_trans_type') THEN
        CREATE INDEX idx_credits_trans_type ON credits(trans_type);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credits' AND indexname = 'idx_credits_created_at') THEN
        CREATE INDEX idx_credits_created_at ON credits(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credits' AND indexname = 'idx_credits_expired_at') THEN
        CREATE INDEX idx_credits_expired_at ON credits(expired_at);
    END IF;

    -- posts 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'idx_posts_slug') THEN
        CREATE INDEX idx_posts_slug ON posts(slug);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'idx_posts_status') THEN
        CREATE INDEX idx_posts_status ON posts(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'idx_posts_created_at') THEN
        CREATE INDEX idx_posts_created_at ON posts(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'idx_posts_locale') THEN
        CREATE INDEX idx_posts_locale ON posts(locale);
    END IF;

    -- affiliates 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'affiliates' AND indexname = 'idx_affiliates_user_uuid') THEN
        CREATE INDEX idx_affiliates_user_uuid ON affiliates(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'affiliates' AND indexname = 'idx_affiliates_invited_by') THEN
        CREATE INDEX idx_affiliates_invited_by ON affiliates(invited_by);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'affiliates' AND indexname = 'idx_affiliates_status') THEN
        CREATE INDEX idx_affiliates_status ON affiliates(status);
    END IF;

    -- feedbacks 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'feedbacks' AND indexname = 'idx_feedbacks_user_uuid') THEN
        CREATE INDEX idx_feedbacks_user_uuid ON feedbacks(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'feedbacks' AND indexname = 'idx_feedbacks_status') THEN
        CREATE INDEX idx_feedbacks_status ON feedbacks(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'feedbacks' AND indexname = 'idx_feedbacks_created_at') THEN
        CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at);
    END IF;

    -- email_verifications 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'email_verifications' AND indexname = 'idx_email_verifications_email_code') THEN
        CREATE INDEX idx_email_verifications_email_code ON email_verifications(email, code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'email_verifications' AND indexname = 'idx_email_verifications_expires_at') THEN
        CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'email_verifications' AND indexname = 'idx_email_verifications_type') THEN
        CREATE INDEX idx_email_verifications_type ON email_verifications(type);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'email_verifications' AND indexname = 'idx_email_verifications_is_used') THEN
        CREATE INDEX idx_email_verifications_is_used ON email_verifications(is_used);
    END IF;

    RAISE NOTICE '基础表索引创建完成';
END $$;

-- 资源管理表索引
DO $$
BEGIN
    -- categories 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'categories' AND indexname = 'idx_categories_parent_id') THEN
        CREATE INDEX idx_categories_parent_id ON categories(parent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'categories' AND indexname = 'idx_categories_sort_order') THEN
        CREATE INDEX idx_categories_sort_order ON categories(sort_order);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'categories' AND indexname = 'idx_categories_name') THEN
        CREATE INDEX idx_categories_name ON categories(name);
    END IF;

    -- resources 表索引（关键性能优化）
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_uuid') THEN
        CREATE INDEX idx_resources_uuid ON resources(uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_category_id') THEN
        CREATE INDEX idx_resources_category_id ON resources(category_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_author_id') THEN
        CREATE INDEX idx_resources_author_id ON resources(author_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_status') THEN
        CREATE INDEX idx_resources_status ON resources(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_created_at') THEN
        CREATE INDEX idx_resources_created_at ON resources(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_rating_avg') THEN
        CREATE INDEX idx_resources_rating_avg ON resources(rating_avg);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_access_count') THEN
        CREATE INDEX idx_resources_access_count ON resources(access_count);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_view_count') THEN
        CREATE INDEX idx_resources_view_count ON resources(view_count);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_is_featured') THEN
        CREATE INDEX idx_resources_is_featured ON resources(is_featured);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_is_free') THEN
        CREATE INDEX idx_resources_is_free ON resources(is_free);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resources' AND indexname = 'idx_resources_credits') THEN
        CREATE INDEX idx_resources_credits ON resources(credits);
    END IF;

    -- tags 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'tags' AND indexname = 'idx_tags_name') THEN
        CREATE INDEX idx_tags_name ON tags(name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'tags' AND indexname = 'idx_tags_usage_count') THEN
        CREATE INDEX idx_tags_usage_count ON tags(usage_count);
    END IF;

    -- resource_tags 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_tags' AND indexname = 'idx_resource_tags_resource_id') THEN
        CREATE INDEX idx_resource_tags_resource_id ON resource_tags(resource_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_tags' AND indexname = 'idx_resource_tags_tag_id') THEN
        CREATE INDEX idx_resource_tags_tag_id ON resource_tags(tag_id);
    END IF;

    -- user_favorites 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_favorites' AND indexname = 'idx_user_favorites_user_uuid') THEN
        CREATE INDEX idx_user_favorites_user_uuid ON user_favorites(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_favorites' AND indexname = 'idx_user_favorites_resource_id') THEN
        CREATE INDEX idx_user_favorites_resource_id ON user_favorites(resource_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_favorites' AND indexname = 'idx_user_favorites_created_at') THEN
        CREATE INDEX idx_user_favorites_created_at ON user_favorites(created_at);
    END IF;

    -- resource_ratings 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_ratings' AND indexname = 'idx_resource_ratings_user_uuid') THEN
        CREATE INDEX idx_resource_ratings_user_uuid ON resource_ratings(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_ratings' AND indexname = 'idx_resource_ratings_resource_id') THEN
        CREATE INDEX idx_resource_ratings_resource_id ON resource_ratings(resource_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_ratings' AND indexname = 'idx_resource_ratings_rating') THEN
        CREATE INDEX idx_resource_ratings_rating ON resource_ratings(rating);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_ratings' AND indexname = 'idx_resource_ratings_created_at') THEN
        CREATE INDEX idx_resource_ratings_created_at ON resource_ratings(created_at);
    END IF;

    -- resource_comments 表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_uuid') THEN
        CREATE INDEX idx_resource_comments_uuid ON resource_comments(uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_resource_id') THEN
        CREATE INDEX idx_resource_comments_resource_id ON resource_comments(resource_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_user_uuid') THEN
        CREATE INDEX idx_resource_comments_user_uuid ON resource_comments(user_uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_parent_id') THEN
        CREATE INDEX idx_resource_comments_parent_id ON resource_comments(parent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_status') THEN
        CREATE INDEX idx_resource_comments_status ON resource_comments(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'resource_comments' AND indexname = 'idx_resource_comments_created_at') THEN
        CREATE INDEX idx_resource_comments_created_at ON resource_comments(created_at);
    END IF;

    RAISE NOTICE '资源管理表索引创建完成';
END $$;

-- ============================================
-- 第四部分：数据库函数
-- ============================================

-- 数据库函数：增加资源浏览量
CREATE OR REPLACE FUNCTION increment_resource_views(resource_uuid VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE resources
    SET view_count = view_count + 1
    WHERE uuid = resource_uuid;
END;
$$ LANGUAGE plpgsql;

-- 数据库函数：增加资源访问量
CREATE OR REPLACE FUNCTION increment_resource_access(resource_uuid VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE resources
    SET access_count = access_count + 1
    WHERE uuid = resource_uuid;
END;
$$ LANGUAGE plpgsql;

-- 数据库函数：增加标签使用次数
CREATE OR REPLACE FUNCTION increment_tag_usage(tag_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE tags
    SET usage_count = usage_count + 1
    WHERE id = tag_id;
END;
$$ LANGUAGE plpgsql;

-- 数据库函数：减少标签使用次数
CREATE OR REPLACE FUNCTION decrement_tag_usage(tag_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE tags
    SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = tag_id;
END;
$$ LANGUAGE plpgsql;

-- 触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 resources 表添加 updated_at 触发器
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_resources_updated_at') THEN
        CREATE TRIGGER update_resources_updated_at
            BEFORE UPDATE ON resources
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 为 resource_comments 表添加 updated_at 触发器
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_resource_comments_updated_at') THEN
        CREATE TRIGGER update_resource_comments_updated_at
            BEFORE UPDATE ON resource_comments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================
-- 第五部分：数据修复（可选）
-- ============================================

-- 字段修复和数据迁移
DO $$
BEGIN
    RAISE NOTICE '开始数据修复和迁移...';

    -- 确保 resources 表字段正确
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
        -- 删除文件类型相关字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_type') THEN
            ALTER TABLE resources DROP COLUMN file_type;
            RAISE NOTICE '已删除 file_type 字段';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_size') THEN
            ALTER TABLE resources DROP COLUMN file_size;
            RAISE NOTICE '已删除 file_size 字段';
        END IF;

        -- 重命名 download_count 为 access_count（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'download_count') THEN
            ALTER TABLE resources RENAME COLUMN download_count TO access_count;
            RAISE NOTICE '已将 download_count 重命名为 access_count';
        END IF;

        -- 修改 price 字段为 credits INTEGER（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'price') THEN
            -- 先添加新的 credits 字段
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'credits') THEN
                ALTER TABLE resources ADD COLUMN credits INTEGER DEFAULT 0;
            END IF;

            -- 将 price 数据迁移到 credits（转换为整数）
            UPDATE resources SET credits = COALESCE(ROUND(price), 0) WHERE price IS NOT NULL;

            -- 删除旧的 price 字段
            ALTER TABLE resources DROP COLUMN price;

            RAISE NOTICE '已将 price 字段转换为 credits INTEGER';
        END IF;

        -- 确保必要字段存在且有默认值
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'access_count') THEN
            ALTER TABLE resources ADD COLUMN access_count INTEGER DEFAULT 0;
            RAISE NOTICE '已添加 access_count 字段';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'credits') THEN
            ALTER TABLE resources ADD COLUMN credits INTEGER DEFAULT 0;
            RAISE NOTICE '已添加 credits 字段';
        END IF;

        -- 添加拒绝原因字段
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'rejection_reason') THEN
            ALTER TABLE resources ADD COLUMN rejection_reason TEXT;
            RAISE NOTICE '已添加 rejection_reason 字段';
        END IF;

        -- 清理 NULL 值
        UPDATE resources SET access_count = 0 WHERE access_count IS NULL;
        UPDATE resources SET credits = 0 WHERE credits IS NULL;
        UPDATE resources SET view_count = 0 WHERE view_count IS NULL;
        UPDATE resources SET rating_avg = 0 WHERE rating_avg IS NULL;
        UPDATE resources SET rating_count = 0 WHERE rating_count IS NULL;

        RAISE NOTICE '已清理 resources 表的 NULL 值';
    END IF;

    -- 删除 download_history 表（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'download_history') THEN
        DROP TABLE download_history CASCADE;
        RAISE NOTICE '已删除 download_history 表';
    END IF;

    -- 删除旧的下载相关函数（如果存在）
    DROP FUNCTION IF EXISTS increment_resource_downloads(VARCHAR);

    RAISE NOTICE '数据修复和迁移完成';
END $$;

-- ============================================
-- 第六部分：数据库准备完成
-- ============================================

-- 注意：分类和标签数据将通过管理接口录入，确保数据安全性和一致性

-- ============================================
-- 完成初始化
-- ============================================

-- 显示初始化完成信息
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    function_count INTEGER;
BEGIN
    -- 统计创建的对象
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public';

    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f';

    RAISE NOTICE '=== 文明知识库数据库初始化完成 ===';
    RAISE NOTICE '完成时间: %', NOW();
    RAISE NOTICE '创建的表数量: %', table_count;
    RAISE NOTICE '创建的索引数量: %', index_count;
    RAISE NOTICE '创建的函数数量: %', function_count;
    RAISE NOTICE '=== 初始化成功 ===';
    RAISE NOTICE '';
    RAISE NOTICE '数据库结构已准备就绪！';
    RAISE NOTICE '请通过管理后台接口录入分类和标签数据，确保数据安全性。';
END $$;

-- 为已存在的分类表添加新字段（兼容已有数据库）
ALTER TABLE categories ADD COLUMN IF NOT EXISTS resource_count INTEGER DEFAULT 0;

-- 为已存在的资源表添加置顶字段（兼容已有数据库）
ALTER TABLE resources ADD COLUMN IF NOT EXISTS top BOOLEAN DEFAULT FALSE;

-- 为已存在的资源表添加AI评分字段（兼容已有数据库）
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_risk_score INTEGER DEFAULT NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_review_result TEXT DEFAULT NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;

-- ============================================
-- 收钱吧支付系统数据库表设计
-- 版本：v1.0
-- 创建时间：2025-07-04
-- 说明：为文明知识库系统添加收钱吧支付功能相关表
-- ============================================

-- 支付订单表
CREATE TABLE IF NOT EXISTS sqb_payment_orders (
    id BIGSERIAL PRIMARY KEY,
    -- 基础订单信息
    client_sn VARCHAR(255) UNIQUE NOT NULL,           -- 商户订单号（我们生成的唯一订单号）
    sn VARCHAR(255),                                  -- 收钱吧订单号
    trade_no VARCHAR(255),                            -- 第三方支付订单号（微信/支付宝）

    -- 用户信息
    user_uuid VARCHAR(255) NOT NULL,                  -- 用户UUID

    -- 支付信息
    total_amount INTEGER NOT NULL,                    -- 支付金额（分）
    net_amount INTEGER,                               -- 实际到账金额（分）
    subject VARCHAR(255) NOT NULL,                    -- 订单标题
    description TEXT,                                 -- 订单描述
    payway VARCHAR(10) NOT NULL,                      -- 支付方式：2=支付宝，3=微信
    payway_name VARCHAR(50),                          -- 支付方式名称

    -- 终端信息
    terminal_sn VARCHAR(255) NOT NULL,                -- 终端序列号
    device_id VARCHAR(255) NOT NULL,                  -- 设备ID

    -- 支付状态
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',    -- 订单状态：CREATED, SUCCESS, FAILED, CANCELLED
    order_status VARCHAR(50),                         -- 收钱吧订单状态

    -- 支付者信息
    payer_uid VARCHAR(255),                           -- 支付者用户ID
    payer_login VARCHAR(255),                         -- 支付者登录名

    -- 二维码信息
    qr_code TEXT,                                     -- 支付二维码链接
    qr_code_image_url TEXT,                           -- 二维码图片链接

    -- 时间信息
    created_at TIMESTAMPTZ DEFAULT NOW(),             -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),             -- 更新时间
    finish_time TIMESTAMPTZ,                          -- 支付完成时间
    channel_finish_time TIMESTAMPTZ,                  -- 渠道完成时间
    expired_at TIMESTAMPTZ,                           -- 订单过期时间（默认30分钟）

    -- 回调处理
    notify_processed BOOLEAN DEFAULT FALSE,           -- 是否已处理回调通知
    notify_processed_at TIMESTAMPTZ,                  -- 回调处理时间

    -- 积分充值信息
    credits_amount INTEGER,                           -- 充值积分数量
    credits_processed BOOLEAN DEFAULT FALSE,          -- 是否已处理积分充值
    credits_processed_at TIMESTAMPTZ,                 -- 积分充值处理时间
    credits_trans_no VARCHAR(255),                    -- 积分充值交易号

    -- 其他信息
    operator VARCHAR(100) DEFAULT 'system',           -- 操作员
    remark TEXT                                       -- 备注
);

-- 支付回调日志表
CREATE TABLE IF NOT EXISTS sqb_payment_callbacks (
    id BIGSERIAL PRIMARY KEY,
    client_sn VARCHAR(255) NOT NULL,                  -- 商户订单号
    callback_data JSONB NOT NULL,                     -- 完整的回调数据
    signature VARCHAR(255),                           -- 回调签名
    signature_verified BOOLEAN DEFAULT FALSE,         -- 签名是否验证通过
    signature_error TEXT,                             -- 签名验证错误信息
    processed BOOLEAN DEFAULT FALSE,                  -- 是否已处理
    processed_at TIMESTAMPTZ,                         -- 处理时间
    error_message TEXT,                               -- 处理错误信息
    created_at TIMESTAMPTZ DEFAULT NOW()              -- 接收时间
);

-- 终端管理表（可选，用于多终端管理）
CREATE TABLE IF NOT EXISTS sqb_terminals (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,           -- 设备ID
    terminal_sn VARCHAR(255) UNIQUE NOT NULL,         -- 终端序列号
    terminal_key VARCHAR(255) NOT NULL,               -- 终端密钥
    activation_code VARCHAR(255),                     -- 激活码
    status VARCHAR(50) DEFAULT 'ACTIVE',              -- 终端状态：ACTIVE, INACTIVE
    last_checkin_at TIMESTAMPTZ,                      -- 最后签到时间
    created_at TIMESTAMPTZ DEFAULT NOW(),             -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),             -- 更新时间
    remark TEXT                                       -- 备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sqb_orders_client_sn ON sqb_payment_orders(client_sn);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_user_uuid ON sqb_payment_orders(user_uuid);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_status ON sqb_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_created_at ON sqb_payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_payway ON sqb_payment_orders(payway);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_terminal_sn ON sqb_payment_orders(terminal_sn);

CREATE INDEX IF NOT EXISTS idx_sqb_callbacks_client_sn ON sqb_payment_callbacks(client_sn);
CREATE INDEX IF NOT EXISTS idx_sqb_callbacks_created_at ON sqb_payment_callbacks(created_at);
CREATE INDEX IF NOT EXISTS idx_sqb_callbacks_processed ON sqb_payment_callbacks(processed);
CREATE INDEX IF NOT EXISTS idx_sqb_callbacks_signature_verified ON sqb_payment_callbacks(signature_verified);

CREATE INDEX IF NOT EXISTS idx_sqb_terminals_device_id ON sqb_terminals(device_id);
CREATE INDEX IF NOT EXISTS idx_sqb_terminals_status ON sqb_terminals(status);

-- 扩展现有 credits 表以支持收钱吧支付
ALTER TABLE credits ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE credits ADD COLUMN IF NOT EXISTS payment_order_sn VARCHAR(255);

-- 为收钱吧支付订单表添加核验状态字段
ALTER TABLE sqb_payment_orders ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'UNVERIFIED';
ALTER TABLE sqb_payment_orders ADD COLUMN IF NOT EXISTS verification_time TIMESTAMPTZ;
ALTER TABLE sqb_payment_orders ADD COLUMN IF NOT EXISTS verification_error TEXT;

-- 为收钱吧支付订单表添加退款相关字段
ALTER TABLE sqb_payment_orders ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0;
ALTER TABLE sqb_payment_orders ADD COLUMN IF NOT EXISTS refund_count INTEGER DEFAULT 0;

-- 为核验状态创建索引
CREATE INDEX IF NOT EXISTS idx_sqb_orders_verification_status ON sqb_payment_orders(verification_status);

-- 退款记录表
CREATE TABLE IF NOT EXISTS sqb_refunds (
    id BIGSERIAL PRIMARY KEY,
    client_sn VARCHAR(255) NOT NULL,                    -- 原订单号
    refund_request_no VARCHAR(255) UNIQUE NOT NULL,     -- 退款序列号（商户生成的唯一退款标识）
    refund_amount INTEGER NOT NULL,                     -- 退款金额（分）
    refund_reason TEXT,                                 -- 退款原因
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',      -- 退款状态：PENDING, SUCCESS, FAILED
    operator VARCHAR(100) NOT NULL,                     -- 操作员
    created_at TIMESTAMPTZ DEFAULT NOW(),               -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),               -- 更新时间
    finish_time TIMESTAMPTZ,                            -- 退款完成时间
    channel_finish_time TIMESTAMPTZ,                    -- 渠道完成时间
    sqb_response JSONB,                                 -- 收钱吧响应数据
    error_message TEXT,                                 -- 错误信息

    -- 收钱吧返回的退款信息
    sn VARCHAR(255),                                    -- 收钱吧订单号
    trade_no VARCHAR(255),                              -- 第三方支付订单号
    settlement_amount INTEGER,                          -- 本次操作金额
    net_amount INTEGER,                                 -- 剩余金额

    -- 外键约束
    FOREIGN KEY (client_sn) REFERENCES sqb_payment_orders(client_sn)
);

-- 退款记录表索引
CREATE INDEX IF NOT EXISTS idx_sqb_refunds_client_sn ON sqb_refunds(client_sn);
CREATE INDEX IF NOT EXISTS idx_sqb_refunds_status ON sqb_refunds(status);
CREATE INDEX IF NOT EXISTS idx_sqb_refunds_created_at ON sqb_refunds(created_at);
CREATE INDEX IF NOT EXISTS idx_sqb_refunds_operator ON sqb_refunds(operator);

-- 创建支付相关索引
CREATE INDEX IF NOT EXISTS idx_credits_payment_method ON credits(payment_method);
CREATE INDEX IF NOT EXISTS idx_credits_payment_order_sn ON credits(payment_order_sn);

-- 优化订单查询性能的索引
CREATE INDEX IF NOT EXISTS idx_sqb_orders_user_uuid ON sqb_payment_orders(user_uuid);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_status_created_at ON sqb_payment_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_verification_status_created_at ON sqb_payment_orders(verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sqb_orders_composite_query ON sqb_payment_orders(status, verification_status, created_at DESC);

-- 用户表索引优化
CREATE INDEX IF NOT EXISTS idx_users_uuid_email_nickname ON users(uuid, email, nickname);

-- 创建支付积分充值事务处理函数
CREATE OR REPLACE FUNCTION process_payment_credits_transaction(
    p_client_sn VARCHAR(255),
    p_user_uuid VARCHAR(255),
    p_credits_amount INTEGER,
    p_trans_no VARCHAR(255)
) RETURNS JSONB AS $$
DECLARE
    v_order_record RECORD;
    v_result JSONB;
BEGIN
    -- 开始事务（函数内部自动处理）

    -- 1. 检查订单是否已经处理过积分（使用FOR UPDATE锁定记录）
    SELECT credits_processed, credits_trans_no
    INTO v_order_record
    FROM sqb_payment_orders
    WHERE client_sn = p_client_sn
    FOR UPDATE;

    -- 检查订单是否存在
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '支付订单不存在'
        );
    END IF;

    -- 检查是否已经处理过
    IF v_order_record.credits_processed THEN
        RETURN jsonb_build_object(
            'success', true,
            'trans_no', v_order_record.credits_trans_no,
            'already_processed', true
        );
    END IF;

    -- 2. 插入积分记录
    INSERT INTO credits (
        trans_no,
        user_uuid,
        trans_type,
        credits,
        order_no,
        payment_method,
        payment_order_sn,
        created_at
    ) VALUES (
        p_trans_no,
        p_user_uuid,
        'RECHARGE',
        p_credits_amount,
        p_client_sn,
        'SQB',
        p_client_sn,
        NOW()
    );

    -- 3. 更新支付订单的积分处理状态
    UPDATE sqb_payment_orders
    SET
        credits_amount = p_credits_amount,
        credits_processed = true,
        credits_processed_at = NOW(),
        credits_trans_no = p_trans_no,
        updated_at = NOW()
    WHERE client_sn = p_client_sn;

    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'trans_no', p_trans_no,
        'already_processed', false
    );

EXCEPTION
    WHEN OTHERS THEN
        -- 发生错误时自动回滚
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 创建退款事务处理函数
CREATE OR REPLACE FUNCTION process_refund_transaction(
    p_client_sn VARCHAR(255),
    p_refund_request_no VARCHAR(255),
    p_refund_amount INTEGER,
    p_new_status VARCHAR(50),
    p_finish_time TIMESTAMPTZ DEFAULT NULL,
    p_channel_finish_time TIMESTAMPTZ DEFAULT NULL,
    p_sqb_response JSONB DEFAULT NULL,
    p_sn VARCHAR(255) DEFAULT NULL,
    p_trade_no VARCHAR(255) DEFAULT NULL,
    p_settlement_amount INTEGER DEFAULT NULL,
    p_net_amount INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_order_record RECORD;
    v_current_refund_amount INTEGER;
    v_current_refund_count INTEGER;
    v_new_refund_amount INTEGER;
    v_new_refund_count INTEGER;
    v_new_order_status VARCHAR(50);
BEGIN
    -- 开始事务（函数内部自动处理）

    -- 1. 锁定订单记录防止并发修改
    SELECT total_amount, refund_amount, refund_count, status
    INTO v_order_record
    FROM sqb_payment_orders
    WHERE client_sn = p_client_sn
    FOR UPDATE;

    -- 检查订单是否存在
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '订单不存在'
        );
    END IF;

    -- 2. 计算新的退款金额和次数
    v_current_refund_amount := COALESCE(v_order_record.refund_amount, 0);
    v_current_refund_count := COALESCE(v_order_record.refund_count, 0);
    v_new_refund_amount := v_current_refund_amount + p_refund_amount;
    v_new_refund_count := v_current_refund_count + 1;

    -- 3. 验证退款金额不超过订单总金额
    IF v_new_refund_amount > v_order_record.total_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '退款金额超过订单总金额'
        );
    END IF;

    -- 4. 确定新的订单状态
    IF v_new_refund_amount >= v_order_record.total_amount THEN
        v_new_order_status := 'REFUNDED';  -- 全额退款
    ELSE
        v_new_order_status := 'PARTIAL_REFUNDED';  -- 部分退款
    END IF;

    -- 如果指定了新状态，使用指定的状态
    IF p_new_status IS NOT NULL THEN
        v_new_order_status := p_new_status;
    END IF;

    -- 5. 更新退款记录状态
    UPDATE sqb_refunds
    SET
        status = 'SUCCESS',
        finish_time = COALESCE(p_finish_time, NOW()),
        channel_finish_time = p_channel_finish_time,
        sqb_response = p_sqb_response,
        sn = p_sn,
        trade_no = p_trade_no,
        settlement_amount = p_settlement_amount,
        net_amount = p_net_amount,
        updated_at = NOW()
    WHERE refund_request_no = p_refund_request_no;

    -- 检查退款记录是否存在
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '退款记录不存在'
        );
    END IF;

    -- 6. 更新订单退款信息
    UPDATE sqb_payment_orders
    SET
        refund_amount = v_new_refund_amount,
        refund_count = v_new_refund_count,
        status = v_new_order_status,
        updated_at = NOW()
    WHERE client_sn = p_client_sn;

    -- 7. 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'new_refund_amount', v_new_refund_amount,
        'new_refund_count', v_new_refund_count,
        'new_order_status', v_new_order_status,
        'remaining_amount', v_order_record.total_amount - v_new_refund_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        -- 发生任何错误时回滚事务并返回错误信息
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 创建订单计数查询函数（性能优化）
CREATE OR REPLACE FUNCTION get_sqb_orders_count(
    p_status VARCHAR(50) DEFAULT NULL,
    p_verification_status VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM sqb_payment_orders
    WHERE (p_status IS NULL OR status = p_status)
      AND (p_verification_status IS NULL OR verification_status = p_verification_status);

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 创建订单JOIN查询函数（性能优化）
CREATE OR REPLACE FUNCTION get_sqb_orders_with_users(
    p_page INTEGER,
    p_limit INTEGER,
    p_status VARCHAR(50) DEFAULT NULL,
    p_verification_status VARCHAR(50) DEFAULT NULL
) RETURNS TABLE (
    client_sn VARCHAR(255),
    user_email VARCHAR(255),
    user_nickname VARCHAR(255),
    subject VARCHAR(255),
    total_amount INTEGER,
    payway VARCHAR(50),
    payway_name VARCHAR(255),
    status VARCHAR(50),
    credits_amount INTEGER,
    created_at TIMESTAMPTZ,
    finish_time TIMESTAMPTZ,
    verification_status VARCHAR(50),
    verification_time TIMESTAMPTZ,
    verification_error TEXT,
    refund_amount INTEGER,
    refund_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.client_sn,
        u.email as user_email,
        u.nickname as user_nickname,
        o.subject,
        o.total_amount,
        o.payway,
        o.payway_name,
        o.status,
        o.credits_amount,
        o.created_at,
        o.finish_time,
        o.verification_status,
        o.verification_time,
        o.verification_error,
        o.refund_amount,
        o.refund_count
    FROM sqb_payment_orders o
    LEFT JOIN users u ON o.user_uuid = u.uuid
    WHERE (p_status IS NULL OR o.status = p_status)
      AND (p_verification_status IS NULL OR o.verification_status = p_verification_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET (p_page - 1) * p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 批量处理日志表
-- 版本：v1.0
-- 创建时间：2025-07-08
-- 说明：用于记录批量上传资源等批量处理任务的日志
-- ============================================

-- 批量处理日志表
CREATE TABLE IF NOT EXISTS batch_logs (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'batch_upload', 'other'
    title VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    details JSONB, -- 存储详细的处理结果
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 批量日志表索引
CREATE INDEX IF NOT EXISTS idx_batch_logs_uuid ON batch_logs(uuid);
CREATE INDEX IF NOT EXISTS idx_batch_logs_user_id ON batch_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_logs_type ON batch_logs(type);
CREATE INDEX IF NOT EXISTS idx_batch_logs_status ON batch_logs(status);
CREATE INDEX IF NOT EXISTS idx_batch_logs_created_at ON batch_logs(created_at);

-- 提交事务
COMMIT;

-- 最终确认
DO $$
BEGIN
    RAISE NOTICE '数据库初始化脚本执行完成！';
    RAISE NOTICE '版本：v2.0';
    RAISE NOTICE '系统：文明知识库';
END $$;
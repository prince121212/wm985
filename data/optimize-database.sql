-- 数据库性能优化脚本
-- 在 Supabase SQL Editor 中执行此脚本来添加缺失的索引

-- ============================================
-- 为 users 表添加重要索引
-- ============================================

-- 检查并创建 email 索引（最重要的优化）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON users(email);
        RAISE NOTICE '已创建 users.email 索引';
    ELSE
        RAISE NOTICE 'users.email 索引已存在';
    END IF;
END $$;

-- 检查并创建 uuid 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_uuid') THEN
        CREATE INDEX idx_users_uuid ON users(uuid);
        RAISE NOTICE '已创建 users.uuid 索引';
    ELSE
        RAISE NOTICE 'users.uuid 索引已存在';
    END IF;
END $$;

-- 检查并创建 signin_provider 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_signin_provider') THEN
        CREATE INDEX idx_users_signin_provider ON users(signin_provider);
        RAISE NOTICE '已创建 users.signin_provider 索引';
    ELSE
        RAISE NOTICE 'users.signin_provider 索引已存在';
    END IF;
END $$;

-- 检查并创建 email_verified 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email_verified') THEN
        CREATE INDEX idx_users_email_verified ON users(email_verified);
        RAISE NOTICE '已创建 users.email_verified 索引';
    ELSE
        RAISE NOTICE 'users.email_verified 索引已存在';
    END IF;
END $$;

-- ============================================
-- 为 orders 表添加重要索引
-- ============================================

-- user_uuid 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_user_uuid') THEN
        CREATE INDEX idx_orders_user_uuid ON orders(user_uuid);
        RAISE NOTICE '已创建 orders.user_uuid 索引';
    ELSE
        RAISE NOTICE 'orders.user_uuid 索引已存在';
    END IF;
END $$;

-- status 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_status') THEN
        CREATE INDEX idx_orders_status ON orders(status);
        RAISE NOTICE '已创建 orders.status 索引';
    ELSE
        RAISE NOTICE 'orders.status 索引已存在';
    END IF;
END $$;

-- ============================================
-- 为 apikeys 表添加重要索引
-- ============================================

-- user_uuid 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'apikeys' AND indexname = 'idx_apikeys_user_uuid') THEN
        CREATE INDEX idx_apikeys_user_uuid ON apikeys(user_uuid);
        RAISE NOTICE '已创建 apikeys.user_uuid 索引';
    ELSE
        RAISE NOTICE 'apikeys.user_uuid 索引已存在';
    END IF;
END $$;

-- ============================================
-- 为 credits 表添加重要索引
-- ============================================

-- user_uuid 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credits' AND indexname = 'idx_credits_user_uuid') THEN
        CREATE INDEX idx_credits_user_uuid ON credits(user_uuid);
        RAISE NOTICE '已创建 credits.user_uuid 索引';
    ELSE
        RAISE NOTICE 'credits.user_uuid 索引已存在';
    END IF;
END $$;

-- ============================================
-- 为 feedbacks 表添加重要索引
-- ============================================

-- user_uuid 索引
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'feedbacks' AND indexname = 'idx_feedbacks_user_uuid') THEN
        CREATE INDEX idx_feedbacks_user_uuid ON feedbacks(user_uuid);
        RAISE NOTICE '已创建 feedbacks.user_uuid 索引';
    ELSE
        RAISE NOTICE 'feedbacks.user_uuid 索引已存在';
    END IF;
END $$;

-- ============================================
-- 查看优化结果
-- ============================================

-- 显示所有新创建的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('users', 'orders', 'apikeys', 'credits', 'feedbacks')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 显示表的大小和索引使用情况
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('users', 'orders', 'apikeys', 'credits', 'feedbacks')
    AND attname IN ('email', 'uuid', 'user_uuid', 'status')
ORDER BY tablename, attname;

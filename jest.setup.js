/**
 * Jest Setup File
 * Initializes environment variables and mocks before tests run
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.PORT = '3000';
process.env.ML_CLIENT_ID = 'test-ml-client-id';
process.env.ML_CLIENT_SECRET = 'test-ml-client-secret';
process.env.ML_URL_REDIRECT = 'https://localhost:3000/auth/callback';
process.env.ML_REDIRECT_URI = 'https://localhost:3000/api/ml/oauth/callback';

// Mock Supabase client to prevent network calls during tests
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn((table) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No rows returned
        }),
      })),
    })),
  };
});


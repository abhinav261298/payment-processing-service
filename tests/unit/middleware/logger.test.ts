import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

// Mock pino
jest.mock('pino');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  })),
};

// Mock pino to return our mock logger
const mockedPino = pino as jest.MockedFunction<typeof pino>;
mockedPino.mockReturnValue(mockLogger as any);

// Import the logger middleware after setting up the mock
import { loggerMiddleware } from '../../../src/middleware/logger';

describe('Logger Middleware', () => {
  let mockRequest: Partial<Request> & { log?: any };
  let mockResponse: Partial<Response> & { on: jest.Mock };
  let nextFunction: jest.MockedFunction<NextFunction>;
  let originalConsoleError: any;
  let originalProcessEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original process.env
    originalProcessEnv = process.env;
    process.env = { ...originalProcessEnv };

    // Mock request and response objects
    mockRequest = {
      id: 'test-correlation-id',
      method: 'GET',
      path: '/test',
      url: '/test?param=value',
      query: { param: 'value' },
      params: {},
      headers: {
        'user-agent': 'test-agent',
        accept: 'application/json',
        authorization: 'Bearer token', // This should be filtered out
      },
      socket: {
        remoteAddress: '::1',
        remotePort: 12345,
      } as any,
    };

    mockResponse = {
      statusCode: 200,
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'application/json' }),
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
        return mockResponse;
      }),
    } as any;

    nextFunction = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock console.error to suppress error logs during tests
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalProcessEnv;

    // Restore console.error
    console.error = originalConsoleError;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should add logger to request object and log request', () => {
    // Arrange
    const req = {
      ...mockRequest,
      id: 'test-correlation-id',
    } as Request;
    const res = mockResponse as unknown as Response;
    const next = jest.fn();

    // Mock the child logger
    const mockChildLogger = {
      info: jest.fn(),
    };
    (mockLogger.child as jest.Mock).mockReturnValue(mockChildLogger);

    // Act
    loggerMiddleware(req, res, next);

    // Assert
    expect(req.log).toBeDefined();
    expect(mockLogger.child).toHaveBeenCalledWith({
      correlationId: 'test-correlation-id',
      path: '/test',
      method: 'GET',
    });

    // Verify request was logged
    expect(mockChildLogger.info).toHaveBeenCalledWith(
      {
        type: 'request',
        method: 'GET',
        url: '/test?param=value',
        headers: {
          accept: 'application/json',
          'user-agent': 'test-agent',
        },
      },
      'Request received'
    );

    expect(next).toHaveBeenCalled();
    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should log response when request completes', () => {
    // Arrange
    let finishCallback: () => void = () => {};
    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
      return mockResponse;
    });

    const mockChildLogger = {
      info: jest.fn(),
    };
    (mockLogger.child as jest.Mock).mockReturnValue(mockChildLogger);

    const req = {
      ...mockRequest,
      id: 'test-correlation-id',
    } as Request;
    const res = {
      ...mockResponse,
      statusCode: 200,
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'application/json' }),
    } as unknown as Response;
    const next = jest.fn();

    // Mock Date.now() to return a fixed value for duration calculation
    const originalDateNow = Date.now;
    const mockNow = 1620000000000;
    global.Date.now = jest.fn(() => mockNow);

    // Act
    loggerMiddleware(req, res, next);
    finishCallback();

    // Restore Date.now
    global.Date.now = originalDateNow;

    // Assert
    expect(mockChildLogger.info).toHaveBeenCalledWith(
      {
        type: 'response',
        status: 200,
        headers: { 'content-type': 'application/json' },
        duration: expect.stringMatching(/^\d+ms$/),
      },
      'Request completed'
    );
  });

  it('should log error for 5xx responses', () => {
    // Arrange
    let finishCallback: () => void = () => {};
    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
      return mockResponse;
    });

    const mockChildLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    (mockLogger.child as jest.Mock).mockReturnValue(mockChildLogger);

    const req = {
      ...mockRequest,
      id: 'test-correlation-id',
      method: 'GET',
      path: '/error',
      url: '/error?test=1',
      headers: {
        'user-agent': 'test-agent',
        accept: 'application/json',
      },
    } as unknown as Request;
    const res = {
      ...mockResponse,
      statusCode: 500,
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'application/json' }),
    } as unknown as Response;
    const next = jest.fn();

    // Mock Date.now() to return a fixed value for duration calculation
    const originalDateNow = Date.now;
    const mockNow = 1620000000000;
    global.Date.now = jest.fn(() => mockNow);

    // Act
    loggerMiddleware(req, res, next);
    finishCallback();

    // Restore Date.now
    global.Date.now = originalDateNow;

    // Assert
    expect(mockLogger.child).toHaveBeenCalledWith({
      correlationId: 'test-correlation-id',
      path: '/error',
      method: 'GET',
    });

    expect(mockChildLogger.error).toHaveBeenCalledWith(
      {
        type: 'response',
        status: 500,
        headers: { 'content-type': 'application/json' },
        duration: expect.stringMatching(/^\d+ms$/),
      },
      'Server error'
    );
  });
});

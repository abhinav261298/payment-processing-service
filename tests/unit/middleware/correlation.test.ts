import { Request, Response, NextFunction } from 'express';
import { correlationMiddleware } from '../../../src/middleware/correlation';

describe('Correlation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let originalConsoleError: any;

  beforeEach(() => {
    // Mock request and response objects
    mockRequest = {
      headers: {},
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    nextFunction = jest.fn();

    // Mock console.error to suppress error logs during tests
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  it('should generate a new correlation ID when none is provided', () => {
    // Act
    correlationMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Assert
    expect(mockRequest.id).toBeDefined();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should use the provided X-Correlation-ID header', () => {
    // Arrange
    const testCorrelationId = 'test-correlation-id';
    mockRequest.headers = { 'x-correlation-id': testCorrelationId };

    // Act
    correlationMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Assert
    expect(mockRequest.id).toBe(testCorrelationId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', testCorrelationId);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should handle case when headers are undefined', () => {
    // Arrange
    mockRequest.headers = undefined;

    // Act
    correlationMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Assert
    expect(mockRequest.id).toBeDefined();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
    expect(nextFunction).toHaveBeenCalled();
  });
});

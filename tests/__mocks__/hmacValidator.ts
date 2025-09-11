// Mock implementation of HmacValidator
class HmacValidator {
  secretKey: string;

  constructor(secretKey: string = 'test-secret-key') {
    this.secretKey = secretKey || 'test-secret-key';
  }

  validate() {
    return true;
  }

  static getMiddleware() {
    return (req: any, res: any, next: any) => next();
  }

  static create() {
    return new HmacValidator('test-secret-key');
  }
}

// Create a mock instance for the default export
const hmacValidator = new HmacValidator('test-secret-key');

// Provide a lazy getter mirroring the production API
let _singleton: HmacValidator | null = null;
export function getHmacValidator(): HmacValidator {
  if (!_singleton) _singleton = hmacValidator;
  return _singleton;
}

// Export both the class and the instance
export { HmacValidator };

export default hmacValidator;

export class BrowserStorage {
  constructor(options = {}) {
    this.prefix = options.prefix || 'zenux_oauth_';
    this.type = options.type || 'sessionStorage';
    this.memory = new Map();
  }

  get(key) {
    const fullKey = this.prefix + key;
    
    if (this.type === 'memory') {
      return this.memory.get(fullKey);
    }
    
    try {
      const storage = this.type === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
      return storage.getItem(fullKey);
    } catch (error) {
      console.warn(`Storage get failed for ${key}:`, error);
      return null;
    }
  }

  set(key, value) {
    const fullKey = this.prefix + key;
    
    if (this.type === 'memory') {
      this.memory.set(fullKey, value);
      return;
    }
    
    try {
      const storage = this.type === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
      storage.setItem(fullKey, value);
    } catch (error) {
      console.warn(`Storage set failed for ${key}:`, error);
    }
  }

  remove(key) {
    const fullKey = this.prefix + key;
    
    if (this.type === 'memory') {
      this.memory.delete(fullKey);
      return;
    }
    
    try {
      const storage = this.type === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
      storage.removeItem(fullKey);
    } catch (error) {
      console.warn(`Storage remove failed for ${key}:`, error);
    }
  }

  clear() {
    if (this.type === 'memory') {
      this.memory.clear();
      return;
    }
    
    try {
      const storage = this.type === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
      
      // Only remove keys with our prefix
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key.startsWith(this.prefix)) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Storage clear failed:', error);
    }
  }
}

export default BrowserStorage;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToken, getToken, isAuthenticated, setToken } from './auth';

function createSessionStorageMock(): Storage {
	const store = new Map<string, string>();

	return {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, value);
		}
	};
}

describe('auth', () => {
	beforeEach(() => {
		vi.stubGlobal('sessionStorage', createSessionStorageMock());
	});

	afterEach(() => {
		sessionStorage.clear();
		vi.unstubAllGlobals();
	});

	it('stores and reads the token from sessionStorage', () => {
		setToken('test-token');
		expect(getToken()).toBe('test-token');
		expect(isAuthenticated()).toBe(true);
	});

	it('clears the token', () => {
		setToken('test-token');
		clearToken();
		expect(getToken()).toBeNull();
		expect(isAuthenticated()).toBe(false);
	});
});

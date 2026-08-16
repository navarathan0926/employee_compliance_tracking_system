const TOKEN_KEY = 'ects_token';

export function getToken(): string | null {
	if (typeof sessionStorage === 'undefined') {
		return null;
	}

	return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	if (typeof sessionStorage === 'undefined') {
		return;
	}

	sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	if (typeof sessionStorage === 'undefined') {
		return;
	}

	sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
	return Boolean(getToken());
}

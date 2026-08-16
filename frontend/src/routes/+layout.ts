import { redirect } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/auth';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = ({ url }) => {
	const path = url.pathname;
	const authenticated = isAuthenticated();
	const isLoginPage = path === '/login';

	if (!isLoginPage && !authenticated) {
		redirect(302, '/login');
	}

	if (isLoginPage && authenticated) {
		redirect(302, '/');
	}

	return {
		isAuthenticated: authenticated,
		isLoginPage
	};
};

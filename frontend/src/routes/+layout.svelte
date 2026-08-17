<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import ToastViewport from '$lib/components/ToastViewport.svelte';
	import { clearToken } from '$lib/auth';

	let { children, data } = $props();

	function logout() {
		clearToken();
		goto(resolve('/login'));
	}

	function navClass(path: string): string {
		return $page.url.pathname === path ? 'nav-link nav-link--active' : 'nav-link';
	}
</script>

<svelte:head>
	<title>Compliance Dashboard</title>
</svelte:head>

<div class="app-shell">
	{#if !data.isLoginPage}
		<header class="app-header">
			<div class="app-header__brand">
				<h1>Employee Compliance Dashboard</h1>
				{#if data.isAuthenticated}
					<nav class="app-nav" aria-label="Main">
						<a class={navClass('/')} href={resolve('/')}>Dashboard</a>
						<a class={navClass('/records')} href={resolve('/records')}>Records</a>
					</nav>
				{/if}
			</div>
			{#if data.isAuthenticated}
				<button type="button" class="btn-text" onclick={logout}>Logout</button>
			{/if}
		</header>
	{/if}

	<main class:app-main={!data.isLoginPage}>
		{@render children()}
	</main>

	<ToastViewport />
</div>

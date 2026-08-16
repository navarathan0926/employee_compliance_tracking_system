<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError, login } from '$lib/api';
	import { setToken } from '$lib/auth';

	let username = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;

		try {
			const response = await login(username.trim(), password);
			setToken(response.accessToken);
			await goto(resolve('/'));
		} catch (error) {
			if (error instanceof ApiError) {
				errorMessage = error.status === 401 ? 'Invalid username or password.' : error.message;
			} else {
				errorMessage = 'Unable to sign in. Please try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<div class="auth-page">
	<div class="auth-card">
		<h1>Sign in</h1>
		<p>Access the compliance dashboard with your credentials.</p>

		{#if errorMessage}
			<p class="form-error" role="alert">{errorMessage}</p>
		{/if}

		<form onsubmit={handleSubmit}>
			<label class="form-field">
				Username
				<input type="text" name="username" autocomplete="username" required bind:value={username} />
			</label>

			<label class="form-field">
				Password
				<input
					type="password"
					name="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/>
			</label>

			<button type="submit" class="btn-primary" disabled={submitting}>
				{submitting ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</div>
</div>

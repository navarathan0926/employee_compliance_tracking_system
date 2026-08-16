<script lang="ts">
	import { DEFAULT_EXPIRING_DAYS, isValidCustomRange } from '$lib/query';
	import type { ExpiringFilterChange } from '$lib/types';

	interface Props {
		onchange?: (filter: ExpiringFilterChange) => void;
	}

	let { onchange }: Props = $props();

	const presets = [7, 30, 90];
	let activePreset = $state(DEFAULT_EXPIRING_DAYS);
	let customFrom = $state('');
	let customTo = $state('');
	let customError = $state('');

	function emitPreset(days: number) {
		activePreset = days;
		customError = '';
		onchange?.({ mode: 'preset', days });
	}

	function applyCustomRange() {
		if (!isValidCustomRange(customFrom, customTo)) {
			customError = 'Enter both dates with start on or before end.';
			return;
		}

		customError = '';
		onchange?.({ mode: 'custom', from: customFrom, to: customTo });
	}
</script>

<section class="date-range-filter">
	<div class="date-range-filter__presets">
		<span class="date-range-filter__label">Expiring within</span>
		<div class="button-group" role="group" aria-label="Preset expiry window">
			{#each presets as days (days)}
				<button type="button" class:active={activePreset === days} onclick={() => emitPreset(days)}>
					{days} days
				</button>
			{/each}
		</div>
	</div>

	<div class="date-range-filter__custom">
		<span class="date-range-filter__label">Custom range</span>
		<div class="date-range-filter__inputs">
			<label>
				From
				<input type="date" bind:value={customFrom} />
			</label>
			<label>
				To
				<input type="date" bind:value={customTo} />
			</label>
			<button type="button" class="btn-secondary" onclick={applyCustomRange}>Apply</button>
		</div>
		{#if customError}
			<p class="form-error" role="alert">{customError}</p>
		{/if}
	</div>
</section>

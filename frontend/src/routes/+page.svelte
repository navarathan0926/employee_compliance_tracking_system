<script lang="ts">
	import { onMount } from 'svelte';
	import BreakdownTable from '$lib/components/BreakdownTable.svelte';
	import DateRangeFilter from '$lib/components/DateRangeFilter.svelte';
	import MetricsCard from '$lib/components/MetricsCard.svelte';
	import RecordsTable from '$lib/components/RecordsTable.svelte';
	import { getExpiring, getMetrics } from '$lib/api';
	import { formatDate } from '$lib/format';
	import { DEFAULT_EXPIRING_DAYS, DEFAULT_PAGE_LIMIT } from '$lib/query';
	import type { ExpiringFilterChange, ExpiringRecord, MetricsResponse } from '$lib/types';

	let metrics = $state<MetricsResponse | null>(null);
	let metricsLoading = $state(true);
	let metricsError = $state('');

	let expiringRecords = $state<ExpiringRecord[]>([]);
	let expiringTotal = $state(0);
	let expiringLimit = $state(DEFAULT_PAGE_LIMIT);
	let expiringOffset = $state(0);
	let expiringFrom = $state('');
	let expiringTo = $state('');
	let expiringLoading = $state(true);
	let expiringError = $state('');

	let showDepartmentBreakdown = $state(false);
	let showTypeBreakdown = $state(false);
	let currentFilter = $state<ExpiringFilterChange>({
		mode: 'preset',
		days: DEFAULT_EXPIRING_DAYS
	});
	let metricsRequestId = 0;
	let expiringRequestId = 0;

	function sameExpiringFilter(a: ExpiringFilterChange, b: ExpiringFilterChange): boolean {
		if (a.mode !== b.mode) {
			return false;
		}

		if (a.mode === 'preset' && b.mode === 'preset') {
			return a.days === b.days;
		}

		return a.mode === 'custom' && b.mode === 'custom' && a.from === b.from && a.to === b.to;
	}

	async function loadMetrics() {
		const requestId = ++metricsRequestId;
		metricsLoading = true;
		metricsError = '';

		try {
			const nextMetrics = await getMetrics({
				departmentBreakdown: showDepartmentBreakdown,
				typeBreakdown: showTypeBreakdown
			});

			if (requestId !== metricsRequestId) {
				return;
			}

			metrics = nextMetrics;
		} catch (error) {
			if (requestId !== metricsRequestId) {
				return;
			}

			metricsError = error instanceof Error ? error.message : 'Failed to load metrics.';
		} finally {
			if (requestId === metricsRequestId) {
				metricsLoading = false;
			}
		}
	}

	async function loadExpiring() {
		const requestId = ++expiringRequestId;
		expiringLoading = true;
		expiringError = '';

		try {
			const response = await getExpiring(currentFilter, {
				limit: expiringLimit,
				offset: expiringOffset
			});

			if (requestId !== expiringRequestId) {
				return;
			}

			expiringRecords = response.data;
			expiringTotal = response.total;
			expiringLimit = response.limit;
			expiringOffset = response.offset;
			expiringFrom = response.from;
			expiringTo = response.to;
		} catch (error) {
			if (requestId !== expiringRequestId) {
				return;
			}

			expiringError = error instanceof Error ? error.message : 'Failed to load expiring records.';
			if (expiringRecords.length === 0) {
				expiringTotal = 0;
			}
		} finally {
			if (requestId === expiringRequestId) {
				expiringLoading = false;
			}
		}
	}

	function handleFilterChange(filter: ExpiringFilterChange) {
		if (sameExpiringFilter(filter, currentFilter) && expiringOffset === 0) {
			return;
		}

		currentFilter = filter;
		expiringOffset = 0;
		void loadExpiring();
	}

	function handlePageChange(offset: number) {
		expiringOffset = offset;
		void loadExpiring();
	}

	function handleBreakdownChange() {
		void loadMetrics();
	}

	onMount(() => {
		void loadMetrics();
		void loadExpiring();
	});

	const departmentRows = $derived(
		(metrics?.byDepartment ?? []).map((row) => ({
			label: row.department,
			active: row.active,
			expiring: row.expiring,
			expired: row.expired
		}))
	);

	const typeRows = $derived(
		(metrics?.byType ?? []).map((row) => ({
			label: row.type,
			active: row.active,
			expiring: row.expiring,
			expired: row.expired
		}))
	);
</script>

<section class="page-section">
	<div class="section-header">
		<h2>Compliance overview</h2>
	</div>

	{#if metricsError}
		<div class="error-banner" role="alert">
			<p>{metricsError}</p>
			<button type="button" class="btn-secondary" onclick={loadMetrics}>Retry</button>
		</div>
	{/if}

	{#if !metrics && metricsLoading}
		<p class="loading-banner">Loading metrics...</p>
	{:else if metrics}
		<div class="metrics-grid" class:is-refreshing={metricsLoading} aria-busy={metricsLoading}>
			<MetricsCard label="Active" value={metrics.totals.active} variant="active" />
			<MetricsCard label="Expiring" value={metrics.totals.expiring} variant="expiring" />
			<MetricsCard label="Expired" value={metrics.totals.expired} variant="expired" />
		</div>

		<div class="breakdown-controls">
			<label>
				<input
					type="checkbox"
					bind:checked={showDepartmentBreakdown}
					onchange={handleBreakdownChange}
				/>
				By department
			</label>
			<label>
				<input type="checkbox" bind:checked={showTypeBreakdown} onchange={handleBreakdownChange} />
				By type
			</label>
		</div>

		<div class:is-refreshing={metricsLoading} aria-busy={metricsLoading}>
			{#if showDepartmentBreakdown}
				<BreakdownTable title="By department" labelHeader="Department" rows={departmentRows} />
			{/if}
			{#if showTypeBreakdown}
				<BreakdownTable title="By type" labelHeader="Type" rows={typeRows} />
			{/if}
		</div>
	{/if}
</section>

<section class="page-section">
	<div class="section-header">
		<div>
			<h2>Expiring soon</h2>
			{#if expiringFrom && expiringTo}
				<p class="section-subtitle">
					Window: {formatDate(expiringFrom)} to {formatDate(expiringTo)}
				</p>
			{/if}
		</div>
	</div>

	<DateRangeFilter onchange={handleFilterChange} />

	{#if expiringError}
		<div class="error-banner" role="alert">
			<p>{expiringError}</p>
			<button type="button" class="btn-secondary" onclick={loadExpiring}>Retry</button>
		</div>
	{/if}

	<RecordsTable
		records={expiringRecords}
		total={expiringTotal}
		limit={expiringLimit}
		offset={expiringOffset}
		loading={expiringLoading}
		onpagechange={handlePageChange}
	/>
</section>

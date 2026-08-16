<script lang="ts">
	interface Props {
		label: string;
		value: number;
		variant: 'active' | 'expiring' | 'expired';
	}

	let { label, value, variant }: Props = $props();
</script>

<article class="metrics-card metrics-card--{variant}">
	<p class="metrics-card__label">{label}</p>
	<p class="metrics-card__value">{value}</p>
</article>

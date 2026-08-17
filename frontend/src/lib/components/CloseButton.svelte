<script lang="ts">
	interface Props {
		disabled?: boolean;
		onclick?: () => void;
	}

	let { disabled = false, onclick }: Props = $props();
</script>

<button type="button" class="btn-icon-close" {disabled} {onclick} aria-label="Close">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 16 16"
		aria-hidden="true"
	>
		<path
			d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
		/>
	</svg>
</button>

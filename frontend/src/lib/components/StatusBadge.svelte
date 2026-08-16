<script lang="ts">
	import { formatStatusLabel } from '$lib/format';
	import type { ComplianceStatus } from '$lib/types';

	interface Props {
		status: ComplianceStatus | string;
	}

	let { status }: Props = $props();
</script>

<span class="status-badge status-{status}">
	{formatStatusLabel(status)}
</span>

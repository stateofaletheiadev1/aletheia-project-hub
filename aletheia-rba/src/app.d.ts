// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	/** Origin of the site, without a trailing slash (PUBLIC_SITE_URL). */
	const __SITE_URL__: string;
	/** "production" allows indexing; anything else is a preview (PUBLIC_DEPLOY_ENV). */
	const __DEPLOY_ENV__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

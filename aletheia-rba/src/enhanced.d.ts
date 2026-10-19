// Ambient type for `?enhanced` image imports (@sveltejs/enhanced-img).
declare module '*?enhanced' {
	const picture: {
		sources: Record<string, string>;
		img: { src: string; w: number; h: number };
	};
	export default picture;
}

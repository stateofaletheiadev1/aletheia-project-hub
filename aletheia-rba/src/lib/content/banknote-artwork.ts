/**
 * Banknote artwork: the images built by scripts/banknotes.ts.
 * `picture` is the responsive set from enhanced-img; `original` is the full-size file, loaded only
 * by the zoom viewer. Dimensions come from the files, never from constants.
 */
/** The object enhanced-img produces for an `?enhanced` import. */
export interface Picture {
	sources: Record<string, string>;
	img: { src: string; w: number; h: number };
}

const pictures = import.meta.glob<Picture>('/src/lib/assets/banknotes/*.jpg', {
	eager: true,
	query: { enhanced: true },
	import: 'default'
});

const originals = import.meta.glob<string>('/src/lib/assets/banknotes/*.jpg', {
	eager: true,
	query: '?url',
	import: 'default'
});

export interface Artwork {
	picture: Picture;
	original: string;
	width: number;
	height: number;
}

const keyOf = (path: string) =>
	path
		.split('/')
		.pop()
		?.replace(/\.jpg$/, '') ?? path;

export const artwork: Record<string, Artwork> = Object.fromEntries(
	Object.entries(pictures).map(([path, picture]) => {
		const original = originals[path];
		if (!original) throw new Error(`No original URL for ${path}`);
		return [keyOf(path), { picture, original, width: picture.img.w, height: picture.img.h }];
	})
);

export function artworkFor(key: string): Artwork {
	const art = artwork[key];
	if (!art) throw new Error(`Missing banknote artwork: ${key}. Run scripts/banknotes.ts.`);
	return art;
}

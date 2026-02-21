import type { Payload } from 'payload';

export const uploadImageFromUrl = async (
  payload: Payload,
  imageUrl: string,
  filename: string
): Promise<string | null> => {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());

    const media = await payload.create({
      collection: 'media',
      data: {
        alt: filename,
      },
      draft:false,
      file: {
        data: buffer,
        name: filename,
        mimetype: res.headers.get('content-type') || 'image/jpeg',
        size: buffer.length,
      },
    });

    return media.id as string;
  } catch (err) {
    console.error('Media upload failed:', err);
    return null;
  }
};

-- Allow private CREOVA post media to include short videos as well as photos.
-- Existing object paths and access policies remain unchanged.

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]::text[]
where id = 'creova-media';

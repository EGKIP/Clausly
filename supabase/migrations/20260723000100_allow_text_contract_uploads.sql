update storage.buckets
set allowed_mime_types = array['application/pdf', 'text/plain']
where id = 'documents';

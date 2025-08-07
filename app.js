// Replace with your Supabase project URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const uploaderSection = document.getElementById('uploader');
const sharerSection = document.getElementById('sharer');
const downloaderSection = document.getElementById('downloader');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const expirationSelect = document.getElementById('expiration-date');
const uploadStatus = document.getElementById('upload-status');
const shareableLinkDiv = document.getElementById('shareable-link');
const downloadLink = document.getElementById('download-link');

async function handleUpload(event) {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
        uploadStatus.innerText = 'Please select a file.';
        return;
    }

    uploadStatus.innerText = 'Uploading...';

    // Generate a unique file ID (UUID)
    const fileId = self.crypto.randomUUID();
    const expirationSeconds = parseInt(expirationSelect.value, 10);

    try {
        // Upload the file to the 'files' bucket
        const { error: uploadError } = await supabase.storage
            .from('files')
            .upload(fileId, file);

        if (uploadError) {
            throw uploadError;
        }

        // Insert file metadata into the 'shared_files' table
        const { data, error: dbError } = await supabase
            .from('shared_files')
            .insert([
                {
                    file_id: fileId,
                    expires_at: new Date(Date.now() + expirationSeconds * 1000).toISOString(),
                },
            ]);

        if (dbError) {
            throw dbError;
        }

        // Hide uploader and show sharer section
        uploaderSection.classList.add('hidden');
        sharerSection.classList.remove('hidden');

        const shareLink = `${window.location.origin}/?fileid=${fileId}`;
        shareableLinkDiv.innerText = shareLink;

        uploadStatus.innerText = '';

    } catch (error) {
        uploadStatus.innerText = `Error: ${error.message}`;
        console.error('Upload error:', error);
    }
}

async function handleDownload() {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileid');

    if (fileId) {
        uploaderSection.classList.add('hidden');
        downloaderSection.classList.remove('hidden');

        try {
            // Check if the file ID exists and is not expired
            const { data, error } = await supabase
                .from('shared_files')
                .select('expires_at')
                .eq('file_id', fileId)
                .single();

            if (error || !data || new Date(data.expires_at) < new Date()) {
                downloaderSection.innerHTML = `<h2>File Not Found or Expired</h2><p>The file ID is invalid or the file has expired.</p>`;
                return;
            }

            // Create a temporary signed URL for the file. This URL has a built-in expiration.
            const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
                .from('files')
                .createSignedUrl(fileId, 60); // URL valid for 60 seconds

            if (signedUrlError) {
                throw signedUrlError;
            }

            // Redirect the user to the signed URL to download the file
            downloadLink.href = signedUrl;
            window.location.href = signedUrl;

        } catch (error) {
            console.error('Download error:', error);
            downloaderSection.innerHTML = `<h2>Error</h2><p>An error occurred while retrieving the file.</p>`;
        }
    }
}

function copyLink() {
    navigator.clipboard.writeText(shareableLinkDiv.innerText).then(() => {
        alert('Link copied to clipboard!');
    });
}

// Event listeners
uploadForm.addEventListener('submit', handleUpload);

// Check if a fileid is present in the URL on page load
window.addEventListener('DOMContentLoaded', handleDownload);

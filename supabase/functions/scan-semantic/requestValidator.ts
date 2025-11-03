/**
 * Request Validation
 * Validates incoming semantic analysis requests
 */ /**
 * Validate semantic analysis request
 */ export function validateSemanticRequest(request) {
  if (!request) {
    return 'Request body is required';
  }
  const { photos, extracted_data, user_declared_gender } = request;
  if (!photos || !Array.isArray(photos) || photos.length !== 2) {
    return 'Exactly 2 photos (front and profile) are required';
  }
  if (!extracted_data || typeof extracted_data !== 'object') {
    return 'Valid extracted_data from scan-estimate is required';
  }
  if (!extracted_data.raw_measurements || typeof extracted_data.raw_measurements !== 'object') {
    return 'Valid raw_measurements in extracted_data is required';
  }
  if (!extracted_data.estimated_bmi || typeof extracted_data.estimated_bmi !== 'number') {
    return 'Valid estimated_bmi in extracted_data is required';
  }
  if (!user_declared_gender || ![
    'masculine',
    'feminine'
  ].includes(user_declared_gender)) {
    return 'Valid user_declared_gender is required (masculine or feminine)';
  }
  // Validate photo structure
  const frontPhoto = photos.find((p)=>p.view === 'front');
  const profilePhoto = photos.find((p)=>p.view === 'profile');
  if (!frontPhoto || !profilePhoto) {
    return 'Both front and profile photos are required';
  }
  if (!frontPhoto.url || !profilePhoto.url) {
    return 'Photo URLs are required';
  }
  if (!frontPhoto.report || !profilePhoto.report) {
    return 'Photo reports are required';
  }
  return null; // Valid request
}

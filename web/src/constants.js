// Mirrors the API's status enum. Order is the pipeline order.
export const STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected'];

export const STATUS_LABEL = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const SORTS = [
  { value: 'created_at', label: 'Date added' },
  { value: 'company', label: 'Company' },
  { value: 'id', label: 'ID' },
];

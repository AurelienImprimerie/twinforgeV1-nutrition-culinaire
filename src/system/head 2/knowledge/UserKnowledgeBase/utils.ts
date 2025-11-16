export function calculateCompleteness(data: any): number {
  if (!data) return 0;

  let score = 0;
  let maxScore = 0;

  const keys = Object.keys(data);
  for (const key of keys) {
    maxScore++;
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      if (Array.isArray(data[key])) {
        if (data[key].length > 0) score++;
      } else {
        score++;
      }
    }
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

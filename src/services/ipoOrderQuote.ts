/** IPO order quote is shares × offer price; broker hold is a separate cash commitment.
 * Monetary values round to EGP piastres; no rounding of entered share count.
 */
export interface IpoOrderQuote {
  requestedShares: number;
  offerPrice: number;
  requestedAmount: number;
  holdPercent: number;
  reservedAmount: number;
}
const roundEgp = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function calculateIpoOrderQuote(
  requestedShares: number,
  offerPrice: number,
  holdPercent: number,
): IpoOrderQuote {
  if (!Number.isSafeInteger(requestedShares) || requestedShares <= 0) {
    throw new Error('Enter a positive whole number of IPO shares.');
  }
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error('Enter a valid price per share greater than zero.');
  }
  if (!Number.isFinite(holdPercent) || holdPercent <= 0 || holdPercent > 100) {
    throw new Error('The broker hold must be between 0% and 100%, excluding zero.');
  }
  const rawTotal = requestedShares * offerPrice;
  if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
    throw new Error('IPO order total is invalid.');
  }
  const requestedAmount = roundEgp(rawTotal);
  const reservedAmount = roundEgp(requestedAmount * holdPercent / 100);
  if (requestedAmount <= 0 || reservedAmount <= 0) {
    throw new Error('IPO amount or broker cash hold rounds to zero EGP.');
  }
  return { requestedShares, offerPrice, requestedAmount, holdPercent, reservedAmount };
}

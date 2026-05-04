const Sentiment = require('sentiment');
const sentiment = new Sentiment();

/**
 * Calculates risk level and sentiment score based on quiz inputs
 * High Risk: mcq_score > 6 OR sentiment_score < -2
 * Moderate Risk: mcq_score > 3 OR sentiment_score < 0
 * Low Risk: otherwise
 * 
 * @param {number} mcqScore Total score from multiple choice questions
 * @param {string} textResponse The open-ended response from the user
 * @returns {object} { risk_level, sentiment_score }
 */
function analyzeRisk(mcqScore, textResponse) {
  // Perform sentiment analysis on the open-ended text response
  const result = sentiment.analyze(textResponse || "");
  const sentimentScore = result.score;
  
  let riskLevel = "Low Risk";
  
  // High Risk condition
  if (mcqScore > 6 || sentimentScore < -2) {
    riskLevel = "High Risk";
  } 
  // Moderate Risk condition
  else if (mcqScore > 3 || sentimentScore < 0) {
    riskLevel = "Moderate Risk";
  }
  
  return {
    risk_level: riskLevel,
    sentiment_score: sentimentScore
  };
}

module.exports = {
  analyzeRisk
};

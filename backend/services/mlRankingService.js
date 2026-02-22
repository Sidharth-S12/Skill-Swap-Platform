import { ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database } from "../config/firebaseConfig.js";

// ================= ML-BASED MENTOR RANKING SERVICE =================

/**
 * Get all feedbacks for a specific user (mentor)
 */
async function getUserFeedbacks(userId) {
    try {
        const feedbacksRef = ref(database, 'feedbacks');
        const q = query(feedbacksRef, orderByChild('ratedUserId'), equalTo(userId));
        const snapshot = await get(q);
        
        const feedbacks = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const val = child.val();
                feedbacks.push({
                    rating: val.rating || 0,
                    comment: val.comment || ''
                });
            });
        }
        
        return feedbacks;
    } catch (error) {
        console.error(`Error fetching feedbacks for user ${userId}:`, error);
        return [];
    }
}

/**
 * Calculate simple ML score on client side (when Python service unavailable)
 * This is a simplified version without sentiment analysis
 */
function calculateSimpleMLScore(mentor) {
    const avgRating = mentor.avgRating || 0;
    const totalRatings = mentor.totalRatings || 0;
    
    if (totalRatings === 0) return 0;
    
    // Rating component (60%)
    const ratingScore = (avgRating / 5.0) * 60;
    
    // Reliability component (40%) - logarithmic scale
    const maxReviews = 20;
    const reliabilityScore = Math.min(1.0, Math.log1p(totalRatings) / Math.log1p(maxReviews)) * 40;
    
    return Math.round((ratingScore + reliabilityScore) * 100) / 100;
}

/**
 * Rank mentors using ML scoring
 * This can be called from browse page to show mentors ranked by quality
 */
export async function rankMentorsByML(mentors) {
    console.log('[ML Ranking] Starting ML-based ranking for', mentors.length, 'mentors');
    
    try {
        // Enhance each mentor with their feedbacks
        const mentorsWithFeedbacks = await Promise.all(
            mentors.map(async (mentor) => {
                const feedbacks = await getUserFeedbacks(mentor.uid);
                return {
                    ...mentor,
                    feedbacks: feedbacks,
                    avgRating: mentor.avgRating || 0,
                    totalRatings: mentor.totalRatings || 0
                };
            })
        );
        
        // Calculate ML score for each mentor (client-side simple version)
        const scoredMentors = mentorsWithFeedbacks.map(mentor => ({
            ...mentor,
            mlScore: calculateSimpleMLScore(mentor)
        }));
        
        // Sort by ML score descending
        const rankedMentors = scoredMentors.sort((a, b) => b.mlScore - a.mlScore);
        
        // Add rank position
        rankedMentors.forEach((mentor, index) => {
            mentor.rank = index + 1;
        });
        
        console.log('[ML Ranking] ✅ Ranking complete. Top 3 mentors:', 
            rankedMentors.slice(0, 3).map(m => ({
                name: m.name,
                mlScore: m.mlScore,
                avgRating: m.avgRating,
                totalRatings: m.totalRatings
            }))
        );
        
        return rankedMentors;
        
    } catch (error) {
        console.error('[ML Ranking] Error during ranking:', error);
        // Fallback: sort by avgRating
        return mentors.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    }
}

/**
 * Get top N mentors for a specific skill using ML ranking
 */
export async function getTopMentorsForSkill(skill, topN = 10) {
    console.log(`[ML Ranking] Finding top ${topN} mentors for skill: ${skill}`);
    
    try {
        // Get all users
        const usersSnap = await get(ref(database, "users"));
        if (!usersSnap.exists()) return [];
        
        const users = usersSnap.val();
        
        // Filter mentors who offer this skill
        const mentors = Object.entries(users)
            .filter(([uid, data]) => {
                const offers = (data.offer || '').toLowerCase();
                return offers.includes(skill.toLowerCase());
            })
            .map(([uid, data]) => ({
                uid,
                name: data.name || 'Unknown',
                email: data.email || '',
                offer: data.offer || '',
                learn: data.learn || '',
                avgRating: data.avgRating || 0,
                totalRatings: data.totalRatings || 0,
                sessionsCompleted: data.sessionsCompleted || 0
            }));
        
        // Rank all mentors
        const rankedMentors = await rankMentorsByML(mentors);
        
        // Return top N
        return rankedMentors.slice(0, topN);
        
    } catch (error) {
        console.error('[ML Ranking] Error getting top mentors:', error);
        return [];
    }
}

/**
 * Display ML ranking badge/score on mentor card
 */
export function createMLScoreBadge(mlScore) {
    const badge = document.createElement('div');
    badge.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold';
    
    // Color coding based on score
    if (mlScore >= 80) {
        badge.className += ' bg-green-500/20 text-green-400 border border-green-500/30';
        badge.innerHTML = `🏆 ${mlScore} `;
    } else if (mlScore >= 60) {
        badge.className += ' bg-blue-500/20 text-blue-400 border border-blue-500/30';
        badge.innerHTML = `⭐ ${mlScore} `;
    } else if (mlScore >= 40) {
        badge.className += ' bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
        badge.innerHTML = `📊 ${mlScore} `;
    } else {
        badge.className += ' bg-gray-500/20 text-gray-400 border border-gray-500/30';
        badge.innerHTML = `📈 ${mlScore} `;
    }
    
    return badge;
}
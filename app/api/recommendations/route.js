import { NextResponse } from 'next/server';
import { getEvents } from '../../../lib/data';
import { getRecommendations } from '../../../lib/reco-engine';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const recommendationOnly = searchParams.get('recommendationOnly') === 'true';
    const category = searchParams.get('category') || 'apparel';
    
    const events = await getEvents();
    const recommendations = await getRecommendations(events, { recommendationOnly, category });
    
    // Return top 6 recommendations
    return NextResponse.json(recommendations.slice(0, 6));
  } catch (error) {
    console.error('Recommendation API error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

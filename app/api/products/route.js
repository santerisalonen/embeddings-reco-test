import { NextResponse } from 'next/server';
import { getManifest } from '../../../lib/data';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'apparel';
    
    const products = await getManifest();
    // Filter by category and remove recommendation-only items from the public catalog
    const catalogProducts = products.filter(p => p.category === category && !p.recommendation_only);
    return NextResponse.json(catalogProducts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

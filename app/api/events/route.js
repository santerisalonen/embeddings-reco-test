import { NextResponse } from 'next/server';
import { saveEvent, clearEvents } from '../../../lib/data';

export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, action } = body;
    
    if (!productId || !action) {
      return NextResponse.json({ error: 'Missing productId or action' }, { status: 400 });
    }

    await saveEvent({ productId, action });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearEvents();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear events' }, { status: 500 });
  }
}

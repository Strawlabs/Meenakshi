import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';

export interface BusinessCardData {
  name: string;
  designation?: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function parseBusinessCard(base64Image: string): Promise<BusinessCardData> {
  const prompt = 'Extract name, designation, organization, email, phone, address from this business card. Return JSON only.';

  const responseText = await generateGeminiContent(prompt, {
    model: 'gemini-3-flash-preview',
    responseMimeType: 'application/json',
    imagePart: {
      mimeType: 'image/jpeg',
      data: base64Image,
    },
  });

  let cardData: BusinessCardData;
  try {
    cardData = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON:', e);
    throw new Error('Failed to parse business card data');
  }

  return cardData;
}

export async function saveBusinessCard(cardData: BusinessCardData): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated in Supabase');

  if (!cardData.name) {
    throw new Error('Could not extract a valid name from the business card');
  }

  // Save to contacts table
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert({
      user_id: user.id,
      name: cardData.name,
      designation: cardData.designation,
      organization: cardData.organization,
      email: cardData.email,
      phone: cardData.phone,
      address: cardData.address,
      notes: cardData.notes || '',
      source: 'business_card',
    })
    .select()
    .single();

  if (contactError) {
    console.error('Error saving contact to Supabase:', contactError);
    throw new Error(contactError.message);
  }

  // Upsert into entities table
  const { error: entityError } = await supabase
    .from('entities')
    .insert({
      user_id: user.id,
      type: 'person',
      name: cardData.name,
      metadata: {
        role: cardData.designation,
        company: cardData.organization,
        email: cardData.email,
        phone: cardData.phone,
        address: cardData.address,
        notes: cardData.notes || '',
        contact_id: contact.id,
        source: 'business_card'
      }
    });

  if (entityError) {
    console.error('Error saving entity to Supabase:', entityError);
  }

  return contact;
}

export async function updateContact(contactId: string, cardData: BusinessCardData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated in Supabase');

  // 1. Update contacts table
  const { error: contactError } = await supabase
    .from('contacts')
    .update({
      name: cardData.name,
      designation: cardData.designation,
      organization: cardData.organization,
      email: cardData.email,
      phone: cardData.phone,
      address: cardData.address,
      notes: cardData.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('user_id', user.id);

  if (contactError) throw new Error(contactError.message);

  // 2. Update entities table matching metadata->>contact_id
  const { data: entities, error: fetchError } = await supabase
    .from('entities')
    .select('id, metadata')
    .eq('user_id', user.id)
    .eq('type', 'person');

  if (!fetchError && entities) {
    const matchingEntity = entities.find(e => e.metadata?.contact_id === contactId);
    if (matchingEntity) {
      await supabase
        .from('entities')
        .update({
          name: cardData.name,
          metadata: {
            ...matchingEntity.metadata,
            role: cardData.designation,
            company: cardData.organization,
            email: cardData.email,
            phone: cardData.phone,
            address: cardData.address,
            notes: cardData.notes,
          }
        })
        .eq('id', matchingEntity.id);
    }
  }
}

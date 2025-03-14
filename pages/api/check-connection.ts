import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // Check if environment variables are set
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Missing environment variables',
        envVarsSet: {
          supabaseUrl: !!supabaseUrl,
          supabaseAnonKey: !!supabaseAnonKey
        }
      });
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test connection by fetching a single record from any table
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        hint: error.hint,
        details: error.details
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Supabase connection successful',
      envVarsSet: {
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey
      }
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error'
    });
  }
}

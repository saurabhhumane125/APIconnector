-- Migration 004: Update Gemini default model to gemini-3.8-flash
UPDATE provider_settings 
SET default_model = 'gemini-3.8-flash' 
WHERE provider_id = 'gemini';

UPDATE connectors 
SET model = 'gemini-3.8-flash' 
WHERE provider = 'gemini';

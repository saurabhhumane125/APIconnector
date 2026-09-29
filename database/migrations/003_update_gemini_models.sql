-- Migration 003: Update Gemini default model to gemini-2.5-flash and update legacy connectors

UPDATE provider_settings 
SET default_model = 'gemini-2.5-flash' 
WHERE provider_id = 'gemini';

UPDATE connectors 
SET model = 'gemini-2.5-flash' 
WHERE provider = 'gemini' AND (model = 'gemini-1.5-flash' OR model IS NULL);

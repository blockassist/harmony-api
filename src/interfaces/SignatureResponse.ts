interface Signature {
  id: number;
  created_at: string; 
  text_signature: string; 
  hex_signature: string; 
  bytes_signature: string; 
}

export default interface SignatureReponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Signature[];
}

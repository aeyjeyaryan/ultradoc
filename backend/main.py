from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import tempfile
import json
from datetime import datetime
import re
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_core.documents import Document as LangchainDocument

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ultra Doc-Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = None
current_document_name = None

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

class QuestionRequest(BaseModel):
    question: str = Field(..., description="Question about the document")
    
class AnswerResponse(BaseModel):
    answer: str
    sources: List[str]
    confidence: float
    metadata: Dict[str, Any]

class StructuredData(BaseModel):
    shipment_id: Optional[str] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    pickup_datetime: Optional[str] = None
    delivery_datetime: Optional[str] = None
    equipment_type: Optional[str] = None
    mode: Optional[str] = None
    rate: Optional[str] = None
    currency: Optional[str] = None
    weight: Optional[str] = None
    carrier_name: Optional[str] = None


def load_document(file_path: str, filename: str) -> List[LangchainDocument]:
    """Load document based on file type"""
    ext = filename.lower().split('.')[-1]
    
    try:
        if ext == 'pdf':
            loader = PyPDFLoader(file_path)
        elif ext in ['docx', 'doc']:
            loader = Docx2txtLoader(file_path)
        elif ext == 'txt':
            loader = TextLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")
        
        return loader.load()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading document: {str(e)}")


def chunk_document(documents: List[LangchainDocument]) -> List[LangchainDocument]:
    """
    Intelligent chunking strategy for logistics documents:
    - Smaller chunks for better precision
    - Overlap to maintain context
    - Preserve semantic boundaries
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        length_function=len,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    )
    
    return text_splitter.split_documents(documents)


def calculate_confidence(
    retrieved_docs: List[LangchainDocument],
    answer: str,
    question: str
) -> float:
    """
    Multi-factor confidence scoring:
    1. Retrieval similarity (from vector search)
    2. Answer length/completeness
    3. Source agreement
    4. Keyword overlap
    """
    if not retrieved_docs:
        return 0.0
    
    # Factor 1: Average retrieval score (if available in metadata)
    retrieval_score = 0.0
    if hasattr(retrieved_docs[0], 'metadata') and 'score' in retrieved_docs[0].metadata:
        scores = [doc.metadata.get('score', 0) for doc in retrieved_docs]
        retrieval_score = sum(scores) / len(scores) if scores else 0
    else:
        # Default high score if we got results
        retrieval_score = 0.8
    
    # Factor 2: Answer completeness (non-empty, reasonable length)
    completeness_score = 0.0
    if answer and len(answer) > 10:
        completeness_score = min(len(answer) / 100, 1.0)
    
    # Factor 3: Keyword overlap between question and sources
    question_keywords = set(question.lower().split())
    source_text = " ".join([doc.page_content for doc in retrieved_docs]).lower()
    overlap = len([k for k in question_keywords if k in source_text]) / max(len(question_keywords), 1)
    
    # Factor 4: Check if answer indicates uncertainty
    uncertainty_phrases = ["not found", "unclear", "don't know", "cannot find", "no information"]
    uncertainty_penalty = 0.3 if any(phrase in answer.lower() for phrase in uncertainty_phrases) else 0
    
    # Weighted combination
    confidence = (
        retrieval_score * 0.4 +
        completeness_score * 0.3 +
        overlap * 0.3
    ) - uncertainty_penalty
    
    return max(0.0, min(1.0, confidence))


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a logistics document"""
    global vector_store, current_document_name
    
    allowed_extensions = ['pdf', 'docx', 'doc', 'txt']
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Allowed: {', '.join(allowed_extensions)}"
        )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Load document
        documents = load_document(tmp_path, file.filename)
        
        # Chunk document
        chunks = chunk_document(documents)
        
        # Create vector store
        vector_store = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            collection_name="logistics_docs"
        )
        
        current_document_name = file.filename
        
        return {
            "message": "Document uploaded and processed successfully",
            "filename": file.filename,
            "chunks_created": len(chunks),
            "total_characters": sum(len(chunk.page_content) for chunk in chunks)
        }
    
    finally:
        os.unlink(tmp_path)


@app.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """Ask a question about the uploaded document"""
    global vector_store
    
    if vector_store is None:
        raise HTTPException(
            status_code=400,
            detail="No document uploaded. Please upload a document first."
        )
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 4}
    )
    
    retrieved_docs = retriever.invoke(request.question)
    
    if not retrieved_docs:
        return AnswerResponse(
            answer="Not found in document - no relevant information available.",
            sources=[],
            confidence=0.0,
            metadata={"guardrail": "no_context_found"}
        )
    

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY")
    )
    
    # Create RAG prompt
    prompt_template = """You are an AI assistant helping with logistics document analysis.

Answer the question based ONLY on the following context from the document. If the answer is not in the context, say "Not found in document".

Context:
{context}

Question: {question}

Answer (be specific and cite relevant details):"""
    
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["context", "question"]
    )
    
    # Create QA chain
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        chain_type_kwargs={"prompt": prompt},
        return_source_documents=True
    )
    
    try:
        result = qa_chain({"query": request.question})
        answer = result["result"]
        source_docs = result.get("source_documents", retrieved_docs)
    except Exception as e:
        # Fallback if LLM fails
        answer = f"Error generating answer: {str(e)}"
        source_docs = retrieved_docs
    
    confidence = calculate_confidence(source_docs, answer, request.question)
    
    # Guardrail: Low confidence threshold
    CONFIDENCE_THRESHOLD = 0.3
    if confidence < CONFIDENCE_THRESHOLD:
        answer = f"[Low confidence] {answer}\n\nNote: This answer may not be reliable. Please verify with the source document."
        metadata = {"guardrail": "low_confidence", "original_confidence": confidence}
    else:
        metadata = {"guardrail": "passed"}
    
    # Extract sources
    sources = [doc.page_content[:200] + "..." for doc in source_docs[:3]]
    
    return AnswerResponse(
        answer=answer,
        sources=sources,
        confidence=round(confidence, 3),
        metadata=metadata
    )


@app.post("/extract", response_model=StructuredData)
async def extract_structured_data():
    """Extract structured shipment data from the document"""
    global vector_store
    
    if vector_store is None:
        raise HTTPException(
            status_code=400,
            detail="No document uploaded. Please upload a document first."
        )
    
    all_docs = vector_store.get()
    full_text = " ".join([doc for doc in all_docs['documents']])
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY")
    )
    
    extraction_prompt = f"""Extract the following shipment information from this logistics document. Return ONLY valid JSON with these exact fields. Use null for missing information.

Document text:
{full_text[:4000]}

Required JSON format:
{{
    "shipment_id": "string or null",
    "shipper": "string or null",
    "consignee": "string or null",
    "pickup_datetime": "string or null",
    "delivery_datetime": "string or null",
    "equipment_type": "string or null",
    "mode": "string or null",
    "rate": "string or null",
    "currency": "string or null",
    "weight": "string or null",
    "carrier_name": "string or null"
}}

Return ONLY the JSON, no other text:"""
    
    try:
        response = llm.invoke(extraction_prompt)
        result_text = response.content
        
        json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
        if json_match:
            extracted_data = json.loads(json_match.group())
        else:
            extracted_data = json.loads(result_text)
        
        return StructuredData(**extracted_data)
    
    except Exception as e:
        return StructuredData()


@app.get("/status")
async def get_status():
    """Get system status"""
    return {
        "status": "online",
        "document_loaded": current_document_name is not None,
        "current_document": current_document_name,
        "vector_store_initialized": vector_store is not None
    }


@app.get("/")
async def root():
    """API root"""
    return {
        "message": "Ultra Doc-Intelligence API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "POST /upload - Upload a document",
            "ask": "POST /ask - Ask questions about the document",
            "extract": "POST /extract - Extract structured data",
            "status": "GET /status - Check system status"
        }
    }




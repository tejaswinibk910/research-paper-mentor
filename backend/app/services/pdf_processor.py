import fitz  
import pdfplumber
from typing import List, Dict, Tuple, Optional
import re
from pathlib import Path


class PDFProcessor:
    """Extract text and metadata from PDF files"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.doc = None
        self.total_pages = 0
        
    def __enter__(self):
        self.doc = fitz.open(self.pdf_path)
        self.total_pages = len(self.doc)
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.doc:
            self.doc.close()
    
    def extract_metadata(self) -> Dict:
        """Extract paper metadata"""
        metadata = self.doc.metadata
        
        return {
            "title": metadata.get("title", ""),
            "authors": self._parse_authors(metadata.get("author", "")),
            "subject": metadata.get("subject", ""),
            "keywords": self._parse_keywords(metadata.get("keywords", "")),
            "creation_date": metadata.get("creationDate", ""),
            "total_pages": self.total_pages
        }
    
    def extract_text_by_page(self) -> List[Dict]:
        """Extract text from each page with metadata"""
        pages = []
        
        for page_num in range(self.total_pages):
            page = self.doc[page_num]
            text = page.get_text()
            
            pages.append({
                "page_number": page_num + 1,
                "text": text,
                "word_count": len(text.split()),
                "char_count": len(text)
            })
        
        return pages
    
    def extract_sections(self) -> List[Dict]:
        """
        Attempt to identify sections based on common patterns
        (Introduction, Methods, Results, etc.)
        """
        full_text = ""
        page_breaks = []
        
        for page_num in range(self.total_pages):
            page = self.doc[page_num]
            page_text = page.get_text()
            page_breaks.append(len(full_text))
            full_text += page_text + "\n\n"
        
        # Common section headers
        section_patterns = [
            r'\n\s*\d+\.?\s+(Abstract|Introduction|Background|Related Work|Literature Review)',
            r'\n\s*\d+\.?\s+(Methods?|Methodology|Approach|Experimental Setup)',
            r'\n\s*\d+\.?\s+(Results?|Findings|Experiments?)',
            r'\n\s*\d+\.?\s+(Discussion|Analysis)',
            r'\n\s*\d+\.?\s+(Conclusion|Summary|Future Work)',
            r'\n\s*\d+\.?\s+(References|Bibliography)',
            r'\n\s*\b(Abstract|Introduction|Methods?|Results?|Discussion|Conclusion)\b',
        ]
        
        sections = []
        pattern = '|'.join(section_patterns)
        matches = list(re.finditer(pattern, full_text, re.IGNORECASE))
        
        if matches:
            for i, match in enumerate(matches):
                start_pos = match.start()
                end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
                
                section_title = match.group(0).strip()
                section_text = full_text[start_pos:end_pos].strip()
                
                # Find which pages this section spans
                start_page = self._find_page_number(start_pos, page_breaks)
                end_page = self._find_page_number(end_pos, page_breaks)
                
                sections.append({
                    "title": section_title,
                    "content": section_text,
                    "page_start": start_page,
                    "page_end": end_page
                })
        else:
            # No clear sections found, treat as single section
            sections.append({
                "title": "Full Document",
                "content": full_text,
                "page_start": 1,
                "page_end": self.total_pages
            })
        
        return sections
    
    def extract_figures_and_tables(self) -> List[Dict]:
        """Extract information about figures and tables"""
        elements = []
        
        # Use pdfplumber for better table extraction
        with pdfplumber.open(self.pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # Extract tables
                tables = page.extract_tables()
                for i, table in enumerate(tables):
                    elements.append({
                        "type": "table",
                        "page": page_num,
                        "index": i,
                        "data": table
                    })
        
        return elements
    
    def _parse_authors(self, author_string: str) -> List[str]:
        """Parse author names from metadata"""
        if not author_string:
            return []
        
        # Common separators
        authors = re.split(r'[;,&]|\band\b', author_string)
        return [a.strip() for a in authors if a.strip()]
    
    def _parse_keywords(self, keywords_string: str) -> List[str]:
        """Parse keywords from metadata"""
        if not keywords_string:
            return []
        
        keywords = re.split(r'[;,]', keywords_string)
        return [k.strip() for k in keywords if k.strip()]
    
    def _find_page_number(self, position: int, page_breaks: List[int]) -> int:
        """Find which page a character position falls on"""
        for i, break_pos in enumerate(page_breaks):
            if position < break_pos:
                return i
        return len(page_breaks)


def process_pdf(pdf_path: str) -> Dict:
    """
    Main function to process a PDF and extract all information
    """
    with PDFProcessor(pdf_path) as processor:
        metadata = processor.extract_metadata()
        pages = processor.extract_text_by_page()
        sections = processor.extract_sections()
        figures_tables = processor.extract_figures_and_tables()
        
        return {
            "metadata": metadata,
            "pages": pages,
            "sections": sections,
            "figures_tables": figures_tables,
            "total_pages": processor.total_pages
        }
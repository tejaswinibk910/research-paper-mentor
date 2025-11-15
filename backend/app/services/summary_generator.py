from typing import List, Dict
from app.core.llm import LLMService
from app.models.paper import PaperSummary


class SummaryGenerator:
    """
    Generate summaries for research papers
    """
    
    def __init__(self):
        self.llm = LLMService()
    
    def generate_paper_summary(
        self,
        paper_id: str,
        sections: List[Dict],
        metadata: Dict = None
    ) -> PaperSummary:
        """
        Generate comprehensive summary of the paper
        
        Args:
            paper_id: ID of the paper
            sections: List of paper sections with 'id', 'title', 'content'
            metadata: Optional paper metadata
            
        Returns:
            PaperSummary object
        """
        print(f"📝 Generating summary for paper {paper_id}...")
        
        # Generate section summaries
        section_summaries = {}
        for i, section in enumerate(sections):
            # Use the provided section ID if available, otherwise generate one
            section_id = section.get("id", f"section_{i}")
            
            print(f"  📄 Summarizing: {section.get('title', 'Untitled')} (ID: {section_id})")
            
            summary = self._summarize_section(
                section_title=section.get("title", ""),
                section_content=section.get("content", "")
            )
            section_summaries[section_id] = summary
        
        # Generate overall summary
        print(f"  🎯 Generating overall summary...")
        overall_summary = self._generate_overall_summary(sections, metadata)
        
        # Extract key findings
        print(f"  💡 Extracting key findings...")
        key_findings = self._extract_key_findings(sections)
        
        # Assess difficulty level
        print(f"  📊 Assessing difficulty...")
        difficulty_level = self._assess_difficulty(sections)
        
        print(f"✅ Summary complete! Generated {len(section_summaries)} section summaries")
        
        return PaperSummary(
            paper_id=paper_id,
            overall_summary=overall_summary,
            key_findings=key_findings,
            section_summaries=section_summaries,
            difficulty_level=difficulty_level
        )
    
    def _summarize_section(
        self,
        section_title: str,
        section_content: str,
        max_length: int = 200
    ) -> str:
        """Generate summary for a single section"""
        
        # Skip empty sections
        if not section_content or len(section_content.strip()) < 50:
            return "Section content too short to summarize."
        
        # If section is already short, return as-is
        if len(section_content) < 200:
            return section_content
        
        # Truncate very long sections for the LLM
        content = section_content[:5000]
        
        prompt = f"""Summarize the following section from a research paper in 2-3 clear sentences.
Focus on the main points and key takeaways.

Section: {section_title}

Content:
{content}

Summary:"""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300
            )
            return response.strip()
        except Exception as e:
            print(f"⚠️  Error summarizing section '{section_title}': {e}")
            # Fallback to truncated content
            return section_content[:max_length] + "..."
    
    def _generate_overall_summary(
        self,
        sections: List[Dict],
        metadata: Dict = None
    ) -> str:
        """Generate overall paper summary"""
        
        # Combine section titles and first parts
        paper_overview = ""
        for section in sections[:5]:  # Use first 5 sections
            title = section.get("title", "")
            content = section.get("content", "")[:500]
            paper_overview += f"## {title}\n{content}\n\n"
        
        # Include metadata if available
        context = ""
        if metadata:
            title = metadata.get("title", "")
            abstract = metadata.get("abstract", "")
            if title:
                context += f"Title: {title}\n\n"
            if abstract:
                context += f"Abstract: {abstract}\n\n"
        
        prompt = f"""{context}

Summarize this research paper in 3-4 sentences. Include:
1. What problem it addresses
2. The approach/methodology
3. Key findings or contributions

Paper content:
{paper_overview}

Summary:"""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=400
            )
            return response.strip()
        except Exception as e:
            print(f"⚠️  Error generating overall summary: {e}")
            return "Unable to generate summary at this time."
    
    def _extract_key_findings(
        self,
        sections: List[Dict],
        max_findings: int = 5
    ) -> List[str]:
        """Extract key findings from the paper"""
        
        # Focus on Results and Conclusion sections
        relevant_text = ""
        for section in sections:
            title = section.get("title", "").lower()
            if any(keyword in title for keyword in ["result", "finding", "conclusion", "discussion"]):
                relevant_text += section.get("content", "")[:3000] + "\n\n"
        
        if not relevant_text:
            # Use all sections if no specific sections found
            relevant_text = " ".join([s.get("content", "")[:1000] for s in sections])
        
        # Skip if no content
        if not relevant_text or len(relevant_text.strip()) < 100:
            return ["Key findings not available."]
        
        prompt = f"""Extract {max_findings} key findings or contributions from this research paper.
Return them as a JSON array of strings, each finding being one clear sentence.

Paper content:
{relevant_text[:4000]}

Return ONLY a JSON array like: ["Finding 1", "Finding 2", ...]
"""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
                json_mode=True
            )
            
            findings = self.llm.parse_json_response(response)
            
            # Handle different response formats
            if isinstance(findings, dict):
                findings = findings.get("findings", findings.get("key_findings", []))
            
            # Ensure we have a list
            if not isinstance(findings, list):
                findings = []
            
            return findings[:max_findings] if findings else ["Key findings not available."]
            
        except Exception as e:
            print(f"⚠️  Error extracting key findings: {e}")
            return ["Unable to extract key findings at this time."]
    
    def _assess_difficulty(self, sections: List[Dict]) -> str:
        """Assess the difficulty level of the paper"""
        
        # Sample content from paper
        sample_text = ""
        for section in sections[:3]:
            sample_text += section.get("content", "")[:1000] + "\n\n"
        
        # Skip if no content
        if not sample_text or len(sample_text.strip()) < 100:
            return "intermediate"
        
        prompt = f"""Assess the difficulty level of this research paper.
Consider:
- Technical jargon and terminology
- Mathematical complexity
- Assumed background knowledge
- Writing style

Respond with ONLY ONE WORD: "beginner", "intermediate", or "advanced"

Paper excerpt:
{sample_text[:2000]}

Difficulty level:"""

        try:
            response = self.llm.generate(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=50
            )
            
            level = response.strip().lower()
            if level in ["beginner", "intermediate", "advanced"]:
                return level
            return "intermediate"
            
        except Exception as e:
            print(f"⚠️  Error assessing difficulty: {e}")
            return "intermediate"
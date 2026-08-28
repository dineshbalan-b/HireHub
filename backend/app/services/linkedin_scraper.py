import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class LinkedInScraper:
    """
    LinkedIn profile extraction service.
    Attempts best-effort public scraping using Playwright / BeautifulSoup,
    and handles candidate-provided professional summary inputs as fallback.
    """
    def __init__(self):
        pass

    async def scrape_public_profile(self, url: str) -> Dict[str, Any]:
        """Best-effort public profile scrape using Playwright."""
        if not url:
            return {"scrape_success": False, "reason": "No LinkedIn URL provided"}

        clean_url = url.strip()
        try:
            # Attempt async playwright browser launch if available
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                # Use standard mobile/desktop user-agent
                await page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                
                response = await page.goto(clean_url, timeout=12000, wait_until="domcontentloaded")
                
                # Check for authwall / login redirect
                if "authwall" in page.url or "login" in page.url:
                    logger.info("LinkedIn authwall encountered.")
                    await browser.close()
                    return {
                        "url": clean_url,
                        "scrape_success": False,
                        "reason": "LinkedIn authwall detected",
                        "requires_fallback_form": True
                    }

                title = await page.title()
                await browser.close()

                return {
                    "url": clean_url,
                    "scrape_success": True,
                    "headline": title.replace("| LinkedIn", "").strip(),
                    "summary": f"Extracted public LinkedIn profile headline: {title}"
                }

        except Exception as e:
            logger.info(f"LinkedIn Playwright scrape skipped/fallback: {e}")
            return {
                "url": clean_url,
                "scrape_success": False,
                "reason": str(e),
                "requires_fallback_form": True
            }

    def process_self_reported_summary(
        self,
        headline: Optional[str] = None,
        current_role: Optional[str] = None,
        experience_years: Optional[int] = None,
        skills_summary: Optional[str] = None,
        key_achievements: Optional[str] = None
    ) -> Dict[str, Any]:
        """Formats candidate self-reported professional summary into LinkedIn-equivalent schema."""
        return {
            "source": "candidate_self_reported",
            "headline": headline or current_role or "Professional Candidate",
            "current_role": current_role,
            "experience_years": experience_years or 0,
            "skills": [s.strip() for s in skills_summary.split(",")] if skills_summary else [],
            "key_achievements": key_achievements
        }

_linkedin_scraper_instance = None

def get_linkedin_scraper() -> LinkedInScraper:
    global _linkedin_scraper_instance
    if _linkedin_scraper_instance is None:
        _linkedin_scraper_instance = LinkedInScraper()
    return _linkedin_scraper_instance

import { Injectable } from "@nestjs/common";

export interface FreelancerProfile {
  id: string;
  skills: string[];
}

@Injectable()
export class MatchingService {
  rankFreelancers(jobDescription: string, freelancers: FreelancerProfile[]) {
    const keywords = this.extractKeywords(jobDescription);

    return freelancers
      .map((freelancer) => {
        const score = this.calculateSkillScore(keywords, freelancer.skills);
        return {
          freelancerId: freelancer.id,
          score,
          matchedSkills: freelancer.skills.filter((skill) =>
            keywords.includes(skill.toLowerCase()),
          ),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private calculateSkillScore(keywords: string[], skills: string[]): number {
    if (keywords.length === 0) return 0;

    const normalizedSkills = skills.map((skill) => skill.toLowerCase());
    const hits = keywords.filter((keyword) => normalizedSkills.includes(keyword)).length;

    return Number(((hits / keywords.length) * 100).toFixed(2));
  }
}


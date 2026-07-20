// Verbatim question labels + "What to include" guidance from the spec.
export const Q = {
  b8: {
    label: 'B8 Business Problem Definition',
    required: true,
    prompt:
      'Describe the specific business challenge your company faced. Include details about how this problem impacted operations, such as delays, bottlenecks, or resource constraints.',
    include:
      'The specific operational challenge your business faced, such as high error rates, time-consuming manual processes, difficulty predicting demand, or poor customer service response times.',
  },
  b9: {
    label: 'B9 Problem Significance',
    prompt:
      'How significant was this problem for your business? Describe the costs or losses in measurable terms (e.g., time lost, financial losses, operational inefficiencies, or missed market opportunities).',
    include:
      "Measurable impact before AI implementation, such as 'Lost $5,000 monthly due to overstocking', 'Spent 20 hours weekly on manual data entry' or 'Operations were delayed by 15 hours per week'.",
  },
  b10: {
    label: 'B10 Solution Effectiveness',
    prompt:
      'How well did your AI solution address the problem? Explain how the solution directly helped solve the challenge or reduce its impact.',
    include:
      'The specific type of AI solution implemented, for example, chatbots, predictive analytics, computer vision, automated scheduling, recommendation engines, or machine learning, and how it addressed the business challenge.',
  },
  c11: {
    label: 'C11 Productivity Gains',
    prompt:
      'What measurable improvements did you see in your key business performance metrics, such as speed, accuracy, or operational efficiency, after implementing the AI solution?',
    include:
      "Concrete numbers or percentages that demonstrate improvements, such as 'Improved process speed by 30%' or 'Increased accuracy in data entry by 25%'.",
  },
  c12: {
    label: 'C12 Financial Impact',
    prompt:
      'What financial benefits were achieved, such as cost savings, return on investment (ROI), or revenue increases, as a result of implementing the AI solution?',
    include:
      "Exact financial figures, ROI percentages, or other financial indicators, such as 'Saved $3,000 monthly in labour costs', 'Increased revenue by 25%' or 'Achieved ROI of 200% in first year'.",
  },
  c13: {
    label: 'C13 Operational Benefits',
    prompt:
      'How did your business operations benefit from the AI solution? Specifically, how did it enhance customer service, streamline processes, or improve product or service quality?',
    include:
      "Specific operational improvements with numbers, such as 'Customer service calls resolved 60% faster', 'Inventory accuracy improved from 85% to 98%' or 'Quality control errors reduced by 45%'.",
  },
  d14: {
    label: 'D14 Staff Adoption & Training',
    required: true,
    prompt:
      'Did your company train staff to ensure successful adoption and ongoing use of the AI solution in daily operations - share details?',
    include:
      "Details about the training process, including any challenges faced and how they were overcome. For example, 'Trained 50 employees over 4 weeks, with 90% adoption rate within 1 month.'",
  },
  d15: {
    label: 'D15 Impact on Work Processes',
    prompt:
      'How has your AI solution changed day-to-day work processes? Explain how it helped employees focus on other tasks or improved operational workflow, and describe any new capabilities developed within the workforce.',
    include:
      "Specific examples of work process changes, such as 'Freed up 20 hours per week for the team to focus on strategic projects' or 'Enabled staff to automate routine tasks and reduce error rates by 15%' or 'staff formerly doing ABC is now able to do XYZ.'",
  },
  d16: {
    label: 'D16 Future Readiness',
    prompt:
      'What are the key learning points from using AI, and how well-prepared is your company for deeper use of AI in the future?',
    include:
      "Insights or skills acquired through the implementation process, such as 'Developed internal AI expertise that will enable us to adopt new AI tools in the next 6 months' or 'Built a foundation for scaling AI initiatives across other departments.'",
  },
};

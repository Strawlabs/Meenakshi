export interface MockEmail {
  id?: string;
  from: string;
  subject: string;
  body: string;
  received_at?: string;
}

export const mockEmails: MockEmail[] = [
  {
    id: 'm1',
    from: 'salary@strawlabs.com',
    subject: 'Salary Credited',
    body: 'Dear Customer, your monthly salary of INR 1,25,000 has been credited to your bank account ending in 1234.',
    received_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
  },
  {
    id: 'm2',
    from: 'alerts@hdfcbank.com',
    subject: 'Home Loan EMI Debited',
    body: 'Dear Customer, your Home Loan EMI of INR 42,500 has been auto-debited from account 1234.',
    received_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  },
  {
    id: 'm3',
    from: 'statements@icicibank.com',
    subject: 'Credit Card Statement Generated',
    body: 'Your credit card statement for ending 5678 has been generated. Total Amount Due: INR 18,720. Due Date is in 10 days. Please pay on time.',
    received_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days ago
  },
  {
    id: 'm4',
    from: 'support@hdfcergo.com',
    subject: 'Health Insurance Policy Renewal Reminder',
    body: 'Dear Customer, your health insurance policy is expiring soon. The renewal premium is INR 15,450. Please renew to keep continuous benefits.',
    received_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
  },
  {
    id: 'm5',
    from: 'rajesh.kumar@hdfcbank.com',
    subject: 'Home Loan Documentation Follow-up',
    body: 'Hi Customer, I need the updated salary slips for the last 3 months to process your loan application extension. Let me know when you can share them.',
    received_at: new Date().toISOString() // today
  }
];

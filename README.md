# Maxien - Authentication & Profile Management App

A fully functional React Vite application with Supabase authentication featuring Google OAuth and email/password login, signup, and profile management.

## Features

✅ **Authentication**
- Email and password signup/login
- Google OAuth authentication
- Secure session management with Supabase
- Protected routes

✅ **User Management**
- Profile page with editable full name
- User information display
- Account creation date tracking
- Last sign-in timestamp

✅ **Dashboard**
- Personalized welcome message
- Account overview cards
- Quick tips and guidance
- Sidebar navigation

✅ **Design**
- Modern dark theme
- Responsive layout
- Theme color: #2596be
- Tailwind CSS styling
- Gradient backgrounds

## Prerequisites

- Node.js 16+ and npm
- Supabase account and project
- Google OAuth credentials (for Google login)

## Installation

### 1. Clone or setup the project

```bash
npm install
```

### 2. Configure Supabase

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://tnvpoxlnneirapttutod.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

**How to get your Supabase credentials:**
1. Go to [Supabase](https://supabase.com)
2. Open your project
3. Navigate to Settings → API
4. Copy the Anon Key and paste it in `.env.local`

### 3. Google OAuth Setup (Optional)

To enable Google login:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add `http://localhost:5173` to Authorized JavaScript origins
6. In Supabase, go to Authentication → Providers
7. Enable Google provider
8. Add your Google OAuth credentials

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

## Building for Production

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
src/
├── pages/
│   ├── Login.jsx          # Email/password login
│   ├── Signup.jsx         # Email/password signup
│   ├── Dashboard.jsx      # Main dashboard layout
│   ├── DashboardHome.jsx  # Dashboard overview
│   └── Profile.jsx        # Profile management
├── context/
│   └── AuthContext.jsx    # Authentication context
├── lib/
│   └── supabase.js        # Supabase client setup
├── App.jsx                # Main app with routing
├── main.jsx               # React entry point
└── index.css              # Tailwind CSS
```

## Usage

### 1. Sign Up
- Enter full name, email, and password
- Or sign up with Google
- Verify email if email verification is enabled

### 2. Sign In
- Use email and password
- Or sign in with Google
- Stay logged in across sessions

### 3. Profile Management
- Navigate to "Profile Settings" from dashboard
- Edit your full name
- View account information
- See account creation and last sign-in dates

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

## Theme Color

Primary color: `#2596be` (Light Blue)

Customize by editing `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: '#your-color-here',
    }
  },
}
```

## Technologies Used

- **React 19** - UI framework
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Supabase** - Backend and authentication
- **Tailwind CSS** - Styling
- **PostCSS** - CSS processing

## Security

- Supabase handles password hashing and storage
- Route protection on dashboard pages
- Auth context prevents unauthorized access
- Environment variables keep sensitive data secure

## Troubleshooting

### "Cannot connect to Supabase"
- Check if `.env.local` file exists
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Ensure Supabase project is active

### "Google login not working"
- Confirm Google OAuth is enabled in Supabase
- Check Google OAuth credentials in Google Cloud Console
- Verify redirect URLs are correct

### "Profile changes not saving"
- Check browser console for errors
- Verify Supabase user authentication is successful
- Ensure Supabase auth is properly configured

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)


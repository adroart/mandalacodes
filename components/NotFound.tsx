
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
            <div className="max-w-xl text-center">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-6 font-semibold">404</span>
                <h1 className="font-display text-5xl md:text-7xl text-wood-900 mb-6 font-medium">
                    Page Not Found
                </h1>
                <p className="font-reading text-xl text-wood-600 mb-8 leading-[1.6] font-light">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                        to="/"
                        className="btn btn-primary"
                    >
                        Go Home <ArrowRight size={14} />
                    </Link>
                    <Link
                        to="/universal-language"
                        className="btn btn-secondary"
                    >
                        Open the Deck
                    </Link>
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-quiet"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </section>
    );
};

export default NotFound;

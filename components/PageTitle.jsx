'use client';

export default function PageTitle({ children, className = '', ...rest }) {
  return (
    <h1 className={`page-title ${className}`.trim()} {...rest}>
      {children}
    </h1>
  );
}

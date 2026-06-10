/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: [
        "@uploadthing/react",
        "uploadthing",
        "@uploadthing/shared",
        "@uploadthing/mime-types",
    ],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'utfs.io',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'img.clerk.com',
            },
        ],
    },
};

export default nextConfig;

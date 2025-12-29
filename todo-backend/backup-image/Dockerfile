FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim

# Install PostgreSQL client at build time (no apt-get during backup runs)
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Default entrypoint runs the backup
ENTRYPOINT ["bash", "/usr/local/bin/backup.sh"]
